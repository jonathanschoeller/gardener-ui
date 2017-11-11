angular.module('GardenerApp', ['chart.js'])
    .config(['$locationProvider', function ($locationProvider) {
        $locationProvider.html5Mode({
            enabled: true,
            requireBase: false
        });
        $locationProvider.hashPrefix('');
    }])
    .controller('GardenerController', function ($scope, $window) {

        var auth = initCognitoSDK(),
            isAuthenticated = false,
            apiUrl = 'https://ox8jzumrwe.execute-api.us-east-1.amazonaws.com/test/topics/',
            topicRoot = 'BALCONY';

        initAWSSDK();

        $scope.ms = Number(localStorage.getItem('ms') || 2000);

        $scope.isAuthenticated = function () {
            return isAuthenticated;
        };

        $scope.signIn = function () {
            auth.getSession();
        };

        $scope.signOut = function () {
            auth.signOut();
        };

        $scope.openValve = function (valveId, ms) {
            sendOpenValveCommand($scope.idToken, encodeURIComponent(topicRoot), valveId, ms);

            function sendOpenValveCommand(idToken, device, valveId, openForMs) {

                function sendData(idToken, data) {

                    $.ajax({
                        type: 'POST',
                        url: apiUrl + device,
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

        var curUrl = window.location.href;
        auth.parseCognitoWebResponse(curUrl);

        // Initialize a cognito auth object.
        function initCognitoSDK() {
            var pageUrl = window.location.href.split('#')[0].replace(/\/$/, ''),
                authData = {
                    ClientId: '45898j2266aq64nv9lqb0lc29e',
                    AppWebDomain: 'schoeller.auth.us-east-1.amazoncognito.com',
                    TokenScopesArray: ['email', 'openid', 'profile'],
                    RedirectUriSignIn: pageUrl,
                    RedirectUriSignOut: pageUrl
                };

            var _auth = new AWSCognito.CognitoIdentityServiceProvider.CognitoAuth(authData);
            _auth.userhandler = {
                onSuccess: function (result) {
                    $scope.idToken = result.getIdToken().getJwtToken();
                    isAuthenticated = true;
                },
                onFailure: function (err) {
                    alert('Error!' + err);
                }
            };

            return _auth;
        }

        function initAWSSDK() {
            // Initialize the Amazon Cognito credentials provider
            AWS.config.region = 'us-east-1'; // Region
            // TODO: Probably need to replace this...
            AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                IdentityPoolId: 'us-east-1:4473d615-0228-42cf-b995-d644ad866c18',
            });
        }

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
            });
        }

        getLightData();
    });