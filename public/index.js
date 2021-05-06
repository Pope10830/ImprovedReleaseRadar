var artistString = "{\"artists\": []}";
var albumString  = "{\"albums\": []}";
var singleString = "{\"singles\": []}";
var releaseString = "{\"releases\": []}";

var followedArtistsPlaceholder;
var followedArtistsTemplate;

var newAlbumsPlaceholder;
var newAlbumsTemplate;

var newSinglesPlaceholder;
var newSinglesTemplate;

var newReleasesPlaceholder;
var newReleasesTemplate;

var filteredReleasesPlaceholder;
var filteredReleasesTemplate;

var access_token;
var user_id;

(function() {

  /**
   * Obtains parameters from the hash of the URL
   * @return Object
   */
  function getHashParams() {
    var hashParams = {};
    var e, r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
    while ( e = r.exec(q)) {
       hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    return hashParams;
  }

  var userProfileSource = document.getElementById('user-profile-template').innerHTML,
      userProfileTemplate = Handlebars.compile(userProfileSource),
      userProfilePlaceholder = document.getElementById('user-profile');

  var oauthSource = document.getElementById('oauth-template').innerHTML,
      oauthTemplate = Handlebars.compile(oauthSource),
      oauthPlaceholder = document.getElementById('oauth');

  var followedArtistsSource = document.getElementById('followed-artists-template').innerHTML;
  followedArtistsTemplate = Handlebars.compile(followedArtistsSource);
  followedArtistsPlaceholder = document.getElementById('followedartists');

  var newAlbumsSource = document.getElementById('new-albums-template').innerHTML;
  newAlbumsTemplate = Handlebars.compile(newAlbumsSource);
  newAlbumsPlaceholder = document.getElementById('newalbums');

  var newSinglesSource = document.getElementById('new-singles-template').innerHTML;
  newSinglesTemplate = Handlebars.compile(newSinglesSource);
  newSinglesPlaceholder = document.getElementById('newsingles');

  var newReleasesSource = document.getElementById('new-releases-template').innerHTML;
  newReleasesTemplate = Handlebars.compile(newReleasesSource);
  newReleasesPlaceholder = document.getElementById('newreleases');

  var filteredReleasesSource = document.getElementById('filtered-releases-template').innerHTML;
  filteredReleasesTemplate = Handlebars.compile(filteredReleasesSource);
  filteredReleasesPlaceholder = document.getElementById('filteredtracks');

  var params = getHashParams();

  access_token = params.access_token;
  var refresh_token = params.refresh_token;
  var error = params.error;

  if (error) {
    alert('There was an error during the authentication');
  } else {
    if (access_token) {
      // render oauth info
      oauthPlaceholder.innerHTML = oauthTemplate({
        access_token: access_token,
        refresh_token: refresh_token
      });

      // Get profile details
      $.ajax({
          url: 'https://api.spotify.com/v1/me',
          headers: {
            'Authorization': 'Bearer ' + access_token
          },
          success: function(response) {
            userProfilePlaceholder.innerHTML = userProfileTemplate(response);

            user_id = response.id;

            $('#login').hide();
            $('#loggedin').show();
          }
      });

      paginate();

      var firstRequest = "https://api.spotify.com/v1/me/following?type=artist&limit=50";
      getArtist(artistCallback, access_token, firstRequest);

      showProfile();
    } else {
        // render initial screen
        $('#login').show();
        $('#loggedin').hide();
    }

    document.getElementById('obtain-new-token').addEventListener('click', function() {
      $.ajax({
        url: '/refresh_token',
        data: {
          'refresh_token': refresh_token
        }
      }).done(function(data) {
        access_token = data.access_token;
        oauthPlaceholder.innerHTML = oauthTemplate({
          access_token: access_token,
          refresh_token: refresh_token
        });
      });
    }, false);
  }
})();

function trackCallback(response) {
  var allTracks = response.tracks;

  if (response.tracks != "[]") {
    trackJson = JSON.parse(releaseString);

    var obj;
    for (obj in allTracks) {
      trackJson.releases.push(allTracks[obj]);
    }

    releaseString = JSON.stringify(trackJson);

    updateReleaseTable();
  }
}

function getTracks(callback, access_token, albumID) {
  $.ajax({
    url: '/getAlbumsTracks',
    async: true,
    data: {
      'access_token': access_token,
      'album_id': albumID
    }
  }).done(function(response) {
    callback(response);
  });
}

function updateReleaseTable() {
  var jsonReleases = JSON.parse(releaseString);
  newReleasesPlaceholder.innerHTML = newReleasesTemplate(jsonReleases);
  paginate();
}

function artistCallback(response) {
  var jsonResponse = JSON.parse(response.artists);
  var jsonArtists = JSON.parse(artistString);

  var obj;
  for(obj in jsonResponse.artists.items) {
    jsonArtists.artists.push(jsonResponse.artists.items[obj]);
  }

  artistString = JSON.stringify(jsonArtists);

  updateArtistTable();

  if (response.nextRequest != null) {
    getArtist(artistCallback, access_token, response.nextRequest);
  } else {
    getArtistsAlbums(albumCallback, access_token, 0);
    getArtistsSingles(singleCallback, access_token, 0);
  }
}

function getArtist(callback, access_token, nextRequest) {
  $.ajax({
    url: '/getFollowedArtists',
    async: true,
    data: {
      'access_token': access_token,
      'nextRequest': nextRequest
    }
  }).done(function(response) {
    callback(response);
  });
}

function updateArtistTable() {
  var jsonArtists = JSON.parse(artistString);
  followedArtistsPlaceholder.innerHTML = followedArtistsTemplate(jsonArtists);
  paginate();
}

function albumCallback(response, artistIndex) {
  var allAlbums = response.albums;

  if (response.albums != "[]") {
    var albumJSON = JSON.parse(albumString);

    var currentDate = new Date();
    var releaseDate;

    var obj;
    for (obj in allAlbums) {
      var releaseDate = getReleaseDate(allAlbums[obj].release_date, allAlbums[obj].release_date_precision);

      if (getDateDifference(releaseDate, currentDate) < 7) {
        albumJSON.albums.push(allAlbums[obj]);

        getTracks(trackCallback, access_token, allAlbums[obj].id);
      }
    }

    albumString = JSON.stringify(albumJSON);

    updateAlbumTable();
  }

  var jsonArtists = JSON.parse(artistString);

  if (artistIndex != jsonArtists.artists.length - 1) { // if more artists to check
    getArtistsAlbums(albumCallback, access_token, artistIndex + 1);
  }
}

function getArtistsAlbums(callback, access_token, artistIndex) {
  var jsonArtists = JSON.parse(artistString);

  $.ajax({
    url: '/getArtistAlbums',
    async: true,
    data: {
      'access_token': access_token,
      'artist_id': jsonArtists.artists[artistIndex].id
    }
  }).done(function(response) {
    callback(response, artistIndex);
  });
}

function updateAlbumTable() {
  var jsonAlbums = JSON.parse(albumString);
  newAlbumsPlaceholder.innerHTML = newAlbumsTemplate(jsonAlbums);
  paginate();
}

function singleCallback(response, artistIndex) {
  var allSingles = response.singles;

  if (response.singles != "[]") {
    var singleJSON = JSON.parse(singleString);

    var currentDate = new Date();
    var releaseDate;

    var obj;
    for (obj in allSingles) {
      var releaseDate = getReleaseDate(allSingles[obj].release_date, allSingles[obj].release_date_precision);

      if (getDateDifference(releaseDate, currentDate) < 7) {
        singleJSON.singles.push(allSingles[obj]);

        getTracks(trackCallback, access_token, allSingles[obj].id);
      }
    }

    singleString = JSON.stringify(singleJSON);

    updateSingleTable();
  }

  var jsonArtists = JSON.parse(artistString);

  if (artistIndex != jsonArtists.artists.length - 1) { // if more artists to check
    getArtistsSingles(singleCallback, access_token, artistIndex + 1);
  }
}

function getArtistsSingles(callback, access_token, artistIndex) {
  var jsonArtists = JSON.parse(artistString);

  $.ajax({
    url: '/getArtistSingles',
    async: true,
    data: {
      'access_token': access_token,
      'artist_id': jsonArtists.artists[artistIndex].id
    }
  }).done(function(response) {
    callback(response, artistIndex);
  });
}

function updateSingleTable() {
  var jsonSingles = JSON.parse(singleString);
  newSinglesPlaceholder.innerHTML = newSinglesTemplate(jsonSingles);
  paginate();
}

function getReleaseDate(releaseDate, releaseDatePrecision) {
  var release = releaseDate.split('-');
  var releaseDate;

  if (releaseDatePrecision == "day") {
    releaseDate = new Date(release[0], release[1] - 1, release[2]);
  } else if (releaseDatePrecision == "month") {
    releaseDate = new Date(release[0], release[1] - 1);
  } else if (releaseDatePrecision == "year") {
    releaseDate = new Date(release[0]);
  }

  return releaseDate;
}

function getDateDifference(date1, date2) {
  var differenceTime = date2.getTime() - date1.getTime();
  var differenceDays = differenceTime / (1000*3600*24);

  return differenceDays;
}

function paginate(){
  $('table.paginated').each(function() {
    var $table = $(this);

    if ($table.siblings('#pager').length) {
      var currentPage = $table.siblings('#pager').children('.active').text() - 1;
    } else {
      var currentPage = 0;
    }

    var numPerPage = 20;

    $table.bind('repaginate', function() {
        $table.find('tbody tr').hide().slice(currentPage * numPerPage, (currentPage + 1) * numPerPage).show();
    });
    $table.trigger('repaginate');

    var numRows = $table.find('tbody tr').length;
    var numPages = Math.ceil(numRows / numPerPage);

    var $div = $table.parent();
    $div.children('#pager').remove(); // remove old pager numbers

    var $pager = $('<div id="pager" class="pager"></div>');

    for (var page = 0; page < numPages; page++) {
        $('<span class="page-number"></span>').text(page + 1).bind('click', {
            newPage: page
        }, function(event) {
            currentPage = event.data['newPage'];
            $table.trigger('repaginate');
            $(this).addClass('active').siblings().removeClass('active');
        }).appendTo($pager).addClass('clickable');
    }

    $pager.insertBefore($table).find('span.page-number:eq(' + currentPage + ')').addClass('active');
  });
}

/* Set the width of the side navigation to 250px */
function openNav() {
  document.getElementById("sideNavbar").style.width = "250px";
}

/* Set the width of the side navigation to 0 */
function closeNav() {
  document.getElementById("sideNavbar").style.width = "0";
}

function showProfile() {
  $('#user-profile').show();
  $('#oauth').show();
  $('#followedartistslist').hide();
  $('#newalbumsdiv').hide();
  $('#newsinglesdiv').hide();
  $('#newreleasesdiv').hide();
  $('#filtereddiv').hide();

  closeNav();
}

function showFollowedArtists() {
  $('#user-profile').hide();
  $('#oauth').hide();
  $('#followedartistslist').show();
  $('#newalbumsdiv').hide();
  $('#newsinglesdiv').hide();
  $('#newreleasesdiv').hide();
  $('#filtereddiv').hide();

  closeNav();
}

function showNewAlbums() {
  $('#user-profile').hide();
  $('#oauth').hide();
  $('#followedartistslist').hide();
  $('#newalbumsdiv').show();
  $('#newsinglesdiv').hide();
  $('#newreleasesdiv').hide();
  $('#filtereddiv').hide();

  closeNav();
}

function showNewSingles() {
  $('#user-profile').hide();
  $('#oauth').hide();
  $('#followedartistslist').hide();
  $('#newalbumsdiv').hide();
  $('#newsinglesdiv').show();
  $('#newreleasesdiv').hide();
  $('#filtereddiv').hide();

  closeNav();
}

function showNewReleases() {
  $('#user-profile').hide();
  $('#oauth').hide();
  $('#followedartistslist').hide();
  $('#newalbumsdiv').hide();
  $('#newsinglesdiv').hide();
  $('#newreleasesdiv').show();
  $('#filtereddiv').hide();

  closeNav();
}

function showFilteredReleaseRadar() {
  $('#user-profile').hide();
  $('#oauth').hide();
  $('#followedartistslist').hide();
  $('#newalbumsdiv').hide();
  $('#newsinglesdiv').hide();
  $('#newreleasesdiv').hide();
  $('#filtereddiv').show();

  closeNav();
}

function logout() {
  $('#login').show();
  $('#loggedin').hide();
}
