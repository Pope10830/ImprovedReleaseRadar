var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var fs = require('fs'); // file system

// Visit https://developer.spotify.com/ to generate client_id and client_secret
// Set redirect_uri to domain_name/callback and set it as the redirect uri on the spotify developer dashboard
var client_id = ''; // Your client id
var client_secret = ''; // Your secret
var redirect_uri = ''; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email user-follow-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          console.log(body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/getFollowedArtists', function(req, res) {
  var access_token = req.query.access_token;
  var requestURL = req.query.nextRequest;

  var authOptions = {
    url: requestURL,
    headers: {
      'Authorization': 'Bearer ' + access_token
    }
  };

  request.get(authOptions, function(error, response, body) {
    if (response.statusCode === 200) {
      var bodyJson = JSON.parse(body);
      res.send({
        'artists': body,
        'nextRequest': bodyJson.artists.next
      });
    } else {
      console.log("Error code: " + response.statusCode);
    }
  });

});

app.get('/getArtistAlbums', function(req, res) {
  var access_token = req.query.access_token;
  var authOptions = {
    url: "https://api.spotify.com/v1/artists/" + req.query.artist_id + "/albums?include_groups=album&country=GB&limit=5",
    headers: {
      'Authorization': 'Bearer ' + access_token
    }
  };

  request.get(authOptions, function(error, response, body) {
    if (response.statusCode === 200) {
      var bodyJson = JSON.parse(body);
      res.send({
        'albums': bodyJson.items
      });
    } else {
      console.log("Error code: " + response.statusCode);
    }
  });

});

app.get('/getArtistSingles', function(req, res) {
  var access_token = req.query.access_token;
  var authOptions = {
    url: "https://api.spotify.com/v1/artists/" + req.query.artist_id + "/albums?include_groups=single&country=GB&limit=5",
    headers: {
      'Authorization': 'Bearer ' + access_token
    }
  };

  request.get(authOptions, function(error, response, body) {
    if (response.statusCode === 200) {
      var bodyJson = JSON.parse(body);
      res.send({
        'singles': bodyJson.items
      });
    } else {
      console.log("Error code: " + response.statusCode);
    }
  });

});

app.get('/getAlbumsTracks', function(req, res) {
  var access_token = req.query.access_token;
  var authOptions = {
    url: "https://api.spotify.com/v1/albums/" + req.query.album_id + "/tracks?limit=50&market=GB",
    headers: {
      'Authorization': 'Bearer ' + access_token
    }
  };

  request.get(authOptions, function(error, response, body) {
    if (response.statusCode === 200) {
      var bodyJson = JSON.parse(body);
      res.send({
        'tracks': bodyJson.items
      });
    } else {
      console.log("Error code: " + response.statusCode);
    }
  });
});

app.get('/saveFilters', function(req, res) {
  var filteredArtists = req.query.filtered_artists;
  var user_id = req.query.user_id;

  var filename = "filters/" + user_id + "_filter.txt";

  fs.writeFile(filename, filteredArtists, function(err, data) {
    if (err) throw err;
  });
});

app.get('/loadFilters', function(req, res) {
  var user_id = req.query.user_id;

  var filename = "filters/" + user_id + "_filter.txt";

  fs.readFile(filename, "utf8", function(err, data) {
    var filteredArtists = data;
    res.send({
      'filtered_artists': filteredArtists
    });
  });
});

app.get('/refresh_token', function(req, res) {
  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

console.log('Listening on 8888');
app.listen(8888);
