angular.module('GardenerApp', ['chart.js'])
    .controller('GardenerController', function ($scope, $window) {

        var topicRoot = awsConfig.topicRoot;

        AWS.config.update(awsConfig.global);
        $scope.ms = Number(localStorage.getItem('ms') || 2000);

        $scope.openValve = function (valveId, ms) {
            sendOpenValveCommand($scope.idToken, encodeURIComponent(topicRoot), valveId, ms);

            function sendOpenValveCommand(idToken, device, valveId, openForMs) {

                function sendData(idToken, data) {

                    $.ajax({
                        type: 'POST',
                        url: awsConfig.apiUrl + device,
                        data: JSON.stringify(data),
                        dataType: 'json',
                        contentType: 'application/json',
                        crossDomain: true,
                        headers: {
                            'Authorization': idToken
                        },
                        success: function (result) {
                            console.log(result);
                        },
                        error: function (req, status, error) {
                            if (error === 'unauthorized' && _auth) {
                                _auth.getSession();
                            } else {
                                alert(error);
                            }
                        }
                    });
                }

                sendData(
                    idToken, {
                        cmd: 'open-valve',
                        id: valveId,
                        ms: openForMs
                    });
            }
        };

        $scope.$watch('ms', function (newValue) {
            localStorage.setItem('ms', newValue);
        });

        $scope.chartOptions = {
            'scales': {
                'yAxes': [{
                    'position': 'left',
                    'id': 'left-axis',
                    ticks: {
                        suggestedMin: 0
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'Light'
                    }
                }, {
                    'position': 'right',
                    'id': 'right-axis',
                    ticks: {
                        suggestedMin: 0
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'Water'
                    }
                }]
            }
        };

        function getThingShadow(thingName, idToken) { 
            var params = {
                thingName: 'esp8266-gardener'
            };

            var iotdata = new AWS.IotData(awsConfig.iotDataOptions);
            iotdata.getThingShadow(params, function(err, data){
                if (err) console.log(err, err.stack);
                else     console.log(data);
            });
        }

        function getData(topic, resultCallback, errorCallback) {
            var days = 2;
            var tableName = 'mqtt-practice';
            var maxItems = 1440 * days;
            var now = new Date().getTime();
            var msPerDay = 24 * 60 * 60 * 1000;
            var yesterday = (now - msPerDay * days).toString();

            //Forming the DynamoDB Query
            var params = {
                TableName: tableName,
                Limit: maxItems,
                ConsistentRead: false,
                ScanIndexForward: true,
                ExpressionAttributeValues: {
                    ':start_date': yesterday,
                    ':event_to_find': topic
                },
                ExpressionAttributeNames: {
                    '#ts': 'timestamp'
                },
                KeyConditionExpression: 'topic = :event_to_find AND #ts >= :start_date'
            };

            var docClient = new AWS.DynamoDB.DocumentClient();
            docClient.query(params, function (err, data) {
                if (err)
                    errorCallback(err, err.stack); // an error occurred
                else {
                    resultCallback(data.Items);
                }
            });
        }

        function getLightData() {
            getData(topicRoot + '/arduino/light', function (items) {

                var recentEventsDateTime = [];
                var lightTemp = [],
                    lightTimes = [];
                items.forEach(function (item) {
                    var payload = item.payload;
                    lightTimes.push(new Date(parseInt(item.timestamp)));
                    lightTemp.push(payload.light);
                });

                getData(topicRoot + '/arduino/commands', function (items) {
                    var waterTemp = [],
                        waterTimes = [];
                    items.forEach(function (item) {
                        var payload = item.payload;
                        waterTimes.push(new Date(parseInt(item.timestamp)));
                        waterTemp.push(payload.ms);
                    });

                    var lightIndex = 0,
                        waterIndex = 0,
                        water = [],
                        light = [];

                    while (lightIndex < lightTemp.length || waterIndex < waterTemp.length) {
                        if (waterIndex >= waterTemp.length || lightTimes[lightIndex] < waterTimes[waterIndex]) {
                            recentEventsDateTime.push(lightTimes[lightIndex].toLocaleTimeString('en-US'));
                            light.push(lightTemp[lightIndex]);
                            water.push(null);
                            lightIndex++;
                        } else if (lightIndex >= lightTemp.length || waterTimes[waterIndex] < lightTimes[lightIndex]) {
                            recentEventsDateTime.push(waterTimes[waterIndex].toLocaleTimeString('en-US'));
                            water.push(waterTemp[waterIndex]);
                            light.push(null);
                            waterIndex++;
                        }
                    }

                    $scope.waterLabels = recentEventsDateTime;
                    $scope.waterData = [light, water];
                    $scope.waterDataSet = [{
                        label: 'Light',
                        type: 'line',
                        yAxisID: 'left-axis'
                    }, {
                        label: 'Water',
                        type: 'bar',
                        yAxisID: 'right-axis'
                    }];

                    $scope.$apply();
                });
            }, function(err, stack){
                console.error(err);
            });
        }

        getLightData();
    });