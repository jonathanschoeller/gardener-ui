var apiUrl = 'https://ox8jzumrwe.execute-api.us-east-1.amazonaws.com/test/topics/';

function getIdToken(session) {
    return session.getIdToken().getJwtToken();
}

// Operations when signed in.
function showSignedIn(session) {
    document.getElementById('statusNotAuth').style.display = 'none';
    document.getElementById('statusAuth').style.display = 'block';
    document.getElementById('signInButton').innerHTML = 'Sign Out';
    if (session) {
        var idToken = getIdToken(session);
        if (idToken) {
            var payload = idToken.split('.')[1];
        }
        var accToken = session.getAccessToken().getJwtToken();
        if (accToken) {
            var accTokenPayload = accToken.split('.')[1];
        }
        var refToken = session.getRefreshToken().getToken();
    }
}

// Operations when signed out.
function showSignedOut() {
    document.getElementById('statusNotAuth').style.display = 'block';
    document.getElementById('statusAuth').style.display = 'none';
}

var _auth = null;

// Initialize a cognito auth object.
function initCognitoSDK() {
    var authData = {
        ClientId: '45898j2266aq64nv9lqb0lc29e',
        AppWebDomain: 'schoeller.auth.us-east-1.amazoncognito.com',
        TokenScopesArray: ['email', 'openid', 'profile'],
        RedirectUriSignIn: 'https://www.self.com/index.html',
        RedirectUriSignOut: 'https://www.self.com/index.html'
    };
    _auth = new AWSCognito.CognitoIdentityServiceProvider.CognitoAuth(authData);
    _auth.userhandler = {
        onSuccess: function (result) {
            showSignedIn(result);
            //sendOpenValveCommand(getIdToken(result), 'YOURTHING', 0, 1000);
        },
        onFailure: function (err) {
            alert('Error!' + err);
        }
    };

    return _auth;
}

function sendOpenValveCommand(idToken, device, valveId, openForMs) {

    function sendData(idToken, data) {

        $.ajax({
            type: 'POST',
            url: apiUrl + device,
            data: data,
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
            'cmd': 'open-valve',
            'id': valveId,
            'ms': openForMs
        });
}

