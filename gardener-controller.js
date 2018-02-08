angular.module('GardenerApp', ['ngResource'])
    .factory('GardenerService', function($resource){
        var headers = {
            'x-api-key': awsConfig.apiKey
        };

        return $resource(awsConfig.apiUrl + '/gardener', {}, {
            'getShadow': {
                method: 'GET',
                headers: headers
            },
            'updateShadow': {
                method: 'POST',
                headers: headers
            }
        });
    })
    .controller('GardenerController', function ($scope, $window, GardenerService) {
        var topicRoot = awsConfig.topicRoot;

        AWS.config.update(awsConfig.global);
        $scope.ms = Number(localStorage.getItem('ms') || 2000);

        $scope.batteryPercent = function(){
            return ($scope.battery - 2500) / 11;
        }

        GardenerService.getShadow(function(shadow){
            $scope.battery = shadow.state.reported.bat;
        });

        $scope.openValve = function (ms) {
            sendOpenValveCommand(ms);

            function openValveError(httpResponse){
                alert("Failed: " + httpResponse.statusText);
            }

            function sendOpenValveCommand(openForMs) {
                GardenerService.getShadow(function(shadow){
                    var state = shadow.state,
                        reported = state.reported,
                        desired = state.desired,
                        version = shadow.version;

                    desired['totalValveOpenMS'] = (desired.totalValveOpenMS || reported.totalValveOpenMS || 0) + ms;

                    GardenerService.updateShadow({
                        state: {
                            desired: desired
                        },
                        version: version
                    }, function(response){
                        alert("Success");
                    }, openValveError);
                }, openValveError);
            }
        };

        $scope.$watch('ms', function (newValue) {
            localStorage.setItem('ms', newValue);
        });
    });