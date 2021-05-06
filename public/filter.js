var filteredString = "{\"releases\": []}";

function setFilters() {
  filterReleases();
}

function saveFilters() {
  var jsonArtists = JSON.parse(artistString);
  var filteredArtists = [];

  var obj;
  for (obj in jsonArtists.artists) {
    var id = jsonArtists.artists[obj].id;
    if ($("#" + id).is(":not(:checked)")) {
      filteredArtists.push(id);
    }
  }

  // Save to file
  $.ajax({
    url: '/saveFilters',
    async: true,
    data: {
      'filtered_artists': filteredArtists.toString(),
      'user_id': user_id
    }
  });
}

function loadFilters() {
  $.ajax({
    url: '/loadFilters',
    async: true,
    data: {
      'user_id': user_id
    }
  }).done(function(response) {
    var jsonArtists = JSON.parse(artistString);
    var filteredArtists = response.filtered_artists.split(",");

    var obj;
    for (obj in jsonArtists.artists) {
      var id = jsonArtists.artists[obj].id;

      if (filteredArtists.includes(id)) {
        $("#" + id).prop("checked", false);
      } else {
        $("#" + id).prop("checked", true);
      }
    }
  });
}

function filterReleases() {
  var jsonTracks = JSON.parse(releaseString);
  var jsonArtists = JSON.parse(artistString);

  filteredString = "{\"releases\": []}";
  var jsonFiltered = JSON.parse(filteredString);

  var track;
  var artist;
  for (track in jsonTracks.releases) {
    var include = true;

    // Filter out unchecked artists
    for (artist in jsonTracks.releases[track].artists) {
      var id = jsonTracks.releases[track].artists[artist].id;
      if ($("#" + id).length && $("#" + id).is(":not(:checked)")) {
        include = false;
      }
    }

    if (include == true) {
      jsonFiltered.releases.push(jsonTracks.releases[track]);
    }
  }

  filteredString = JSON.stringify(jsonFiltered);
  updateFilteredReleaseTable();
}

function updateFilteredReleaseTable() {
  var jsonFiltered = JSON.parse(filteredString);
  filteredReleasesPlaceholder.innerHTML = filteredReleasesTemplate(jsonFiltered);

  paginate();
}
