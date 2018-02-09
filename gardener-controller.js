angular.module('GardenerApp', ['ngResource'])
    .service('CognitoService', function($window){
        var CognitoAuth = AmazonCognitoIdentity.CognitoAuth;
        var authData = {
            ClientId : '45898j2266aq64nv9lqb0lc29e',
            AppWebDomain : 'schoeller.auth.us-east-1.amazoncognito.com',
            TokenScopesArray : ['email', 'profile','openid'],
            RedirectUriSignIn : 'https://www.self.com/index.html',
            RedirectUriSignOut : 'https://www.self.com/index.html',
            UserPoolId : 'us-east-1_XhnjRllOF'
        };

        var auth = new AWSCognito.CognitoIdentityServiceProvider.CognitoAuth(authData);
        auth.userhandler = {
            onSuccess: function(result){
                console.log(result);
                return result;
            },
            onFailure: function(err){
                console.error(err);
                return err;
            }
        };

        var curUrl = $window.location.href;
        auth.parseCognitoWebResponse(curUrl);

        this.signIn = function() {
            auth.getSession();
        }

        this.signOut = function() {
            auth.signOut();
        }

        this.isAuthenticated = function() {
            return auth.isUserSignedIn();
        }

        this.getIdToken = function() {
            var session = auth.isUserSignedIn() ? auth.getSession() : null;
            return auth.getSignInUserSession().getIdToken().getJwtToken();
        }
    })
    .factory('GardenerService', function($resource, CognitoService) {
        var headers = {
            'x-cognito-auth': CognitoService.getIdToken()
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
    .controller('GardenerController', function ($scope, GardenerService, CognitoService) {
        AWS.config.update(awsConfig.global);

        $scope.signIn = CognitoService.signIn;
        $scope.signOut = CognitoService.signOut;
        $scope.isAuthenticated = CognitoService.isAuthenticated;

        $scope.ms = Number(localStorage.getItem('ms') || 2000);

        $scope.batteryPercent = function(){
            return ($scope.battery - 2500) / 11;
        }

        if (CognitoService.isAuthenticated()) {
            GardenerService.getShadow(function(shadow){
                $scope.battery = shadow.state.reported.bat;
            });
        }

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