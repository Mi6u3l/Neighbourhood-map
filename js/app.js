
/*
 * Venue model.
 * The Venue model that initialize and store venue data
 */

 var VenueTypeModel = function(data){
    var self = this;
    self.name = ko.observable(data.name);
};

var Venue = function(data, foursquareID) {
	// data that is always defined or need no formatting
	this.id = data.venue.id;
	this.name = data.venue.name;
	this.lat = data.venue.location.lat;
	this.lon = data.venue.location.lng;
	this.formattedAddress = data.venue.location.formattedAddress;
	this.categories = data.venue.categories[0].name;
	this.foursquareUrl = "https://foursquare.com/v/" + this.id;
	this.photoAlbumn = [];
	this.marker = {};
	this.photoPrefix = 'https://irs0.4sqi.net/img/general/';
	this.photoPlaceHolder = 'http://placehold.it/100x100';
	this.photoSuffix;
	this.basePhotoAlbumnURL = 'https://api.foursquare.com/v2/venues/';

	// data that may be undefined or need formatting
	this.photoAlbumnURL = this.getPhotoAlbumnURL(data, foursquareID);

	this.formattedPhone = this.getFormattedPhone(data);

	this.tips = this.getTips(data);

	this.url = this.getUrl(data);

	this.rating = this.getRating(data);

	this.featuredPhoto = this.getFeaturedPhoto(data);

};

// functions for Venue data error handlings and formmatting
Venue.prototype = {

	getPhotoAlbumnURL: function(data, foursquareID) {
		return this.basePhotoAlbumnURL + this.id + '/photos?' + foursquareID + '&v=20130815';
	},

	getFormattedPhone: function(data) {
		if ( !data.venue.contact.formattedPhone )
			return 'Contact Not Available';
		else
			return data.venue.contact.formattedPhone;
	},

	getTips: function(data) {
		if ( !data.tips )
			return 'Tips Not Available';
		else
			return data.tips[0].text;
	},

	getUrl: function(data) {
		if ( !data.venue.url )
			return 'Website Not Available';
		else
			return data.venue.url;
	},

	getRating: function(data) {
		if ( !data.venue.rating )
			return '0.0';
		else
			return data.venue.rating;
	},

	getFeaturedPhoto: function(data) {
		if ( !data.venue.featuredPhotos )
			return this.photoPlaceHolder;
		else {
			this.photoSuffix = data.venue.featuredPhotos.items[0].suffix;
  			return this.photoPrefix + 'width100' + this.photoSuffix;
		}
	}
};



/*
 * neighbourhood Map View Model.
 * The View Model for neighbourhood Map application
 */
function AppViewModel() {

	var self = this;
	var map,
		mapOptions,
		placeLat,
		placeLon,
		bounds,
		service,
		marker,
		infowindow;

	var venueMarkers = [];
	var defaultneighbourhood = 'Dublin';
	var days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
	var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

	self.venueTypeOptions = ko.observableArray([
        new VenueTypeModel({ name: "Food"}),
        new VenueTypeModel({ name: "Coffee"}),
        new VenueTypeModel({ name: "Nightlife"}),
        new VenueTypeModel({ name: "Fun"}),
        new VenueTypeModel({ name: "Shopping"})]);

	self.selectedVenueType = ko.observable();




	//self.exploreKeyword = ko.observableArray(['Shop']);
	self.neighbourhood = ko.observable(defaultneighbourhood);	// neighbourhood location
	self.currentneighbourhoodMarker = ko.observable(''); // current neighbourhood marker
	self.formattedAddress = ko.observable('');	// formatted neighbourhood location address
	self.topPicks = ko.observableArray('');	// most popular foursquare picks depending on neighbourhood keywords and location
	self.selectedVenue = ko.observable(''); // selected venue info
	self.selectedMarker = ko.observable(''); // selected marker info
	self.displayVenuesList = ko.observable('false'); // boolean value for venues list display

	/**
 	 * Get month name according to javascript getMonth() method return value
 	 * @return {string}
 	 */
	Date.prototype.getMonthName = function() {
		return months[ this.getMonth() ];
	};

	/**
 	 * Get day name according to javascript getDay() method return value
 	 * @return {string}
 	 */
	Date.prototype.getDayName = function() {
		return days[ this.getDay() ];
	};


	
	// custom binding handler that tracks html binding changes 
	// and fires callback when value is updated
	// reference: http://stackoverflow.com/questions/16250594/afterrender-for-html-binding
  	ko.bindingHandlers.afterHtmlRender = {
		update: function(el, va, ab) {
			ab().html && va()(ab().html);
		}
	};


	// update function for venues list display
	self.updateVObservable = function() {
		self.displayVenuesList(!self.displayVenuesList());
	};

	// takes user's input in neighbourhood address
	// update displays for map and popular venues
	self.computedneighbourhood = function() {

		if (!isEmpty(self.neighbourhood())) {
			removeVenueMarkers();
			self.topPicks([]);
			getneighbourhood(self.neighbourhood());		
		} 
		
	};

	// check if user's input string is blank or contains only white-space
	function isEmpty(input) {
		return (input.length === 0 || !input.trim());
	}

	// when user update neighbourhood address in input bar,
	// update displays for map and popular venues
	self.neighbourhood.subscribe(self.computedneighbourhood);	

	// when user update explore keyword in input bar,
	// update displays for map and popular venues
	//self.exploreKeyword.subscribe(self.computedneighbourhood);
	self.selectedVenueType.subscribe(self.computedneighbourhood);

	/**
 	 * When venue item is clicked in venues listing,
 	 * panto the venue marker on map, display infowindow, 
 	 * start marker bounce animation
 	 * @param {Object} venue A clicked venue object in venues list
 	 * @return {void}
 	 */ 
	self.panToMarker = function(venue) {

		var venueInfowindowStr = setVenueInfowindowStr(venue);
		var venuePosition = new google.maps.LatLng(venue.lat, venue.lon);

		self.selectedMarker(venue.marker);
		self.selectedVenue(venue.id);
		infowindow.setContent(venueInfowindowStr);
		infowindow.open(map, venue.marker);
		map.panTo(venuePosition);
		selectedMarkerBounce(venue.marker);

	};

	// empty venuMarkers array, remove all venue markers on map
	// this function gets called once neighbourhood keywords or address is updated
	function removeVenueMarkers() {

		// clear current neighbourhood marker
		self.currentneighbourhoodMarker.setMap(null);

		// clear all venues' markers
		self.topPicks().forEach(function(venueItem) {
			venueItem.marker.setMap(null);
			venueItem.marker = {};
		});

	}


	/**
 	 * Create a neighbourhood marker in a shape of start in black color
 	 * for neighbourhood address user input in the address input bar
 	 * @param {Object} place A place object returned by Google Map place callback
 	 * @return {void}
 	 */ 
	function createneighbourhoodMarker(place) {

		var placeName = place.name;

		// create a black star
		var blackStar = {
		    path: 'M 125,5 155,90 245,90 175,145 200,230 125,180 50,230 75,145 5,90 95,90 z',
		    fillColor: 'black',
		    fillOpacity: 1,
		    scale: 0.2
		};

		// create a marker for this position
		var marker = new google.maps.Marker({
			map: map,
			position: place.geometry.location,
			title: placeName,
			icon: blackStar
		});

		// add click event to this marker
		google.maps.event.addListener(marker, 'click', function() {
			infowindow.setContent(placeName);
			infowindow.open(map, marker);
		});

		// set current neighbourhood marker to this marker
		self.currentneighbourhoodMarker = marker; 

	}

	/**
 	 * Get best nearby neighbourhood venues data from foursquare API,
 	 * create venues markers on map
 	 * @param {Object} place A place object returned by Google Map place callback
 	 * @return {void}
 	 */
	function getneighbourhoodVenues(place) {

		infowindow = new google.maps.InfoWindow();
		placeLat = place.geometry.location.lat();
		placeLon = place.geometry.location.lng();
		self.formattedAddress(place.formatted_address);
		var newneighbourhood = new google.maps.LatLng(placeLat, placeLon);
		map.setCenter(newneighbourhood);

		// create one marker for neighbourhood address user input
		createneighbourhoodMarker(place);

		// get nearby venues based on explore keywords and neighbourhood address
		getFoursquareData(); 	

		// disable marker animation when infowindow is closed
		google.maps.event.addListener(infowindow, 'closeclick', function() {  
			self.selectedMarker().setAnimation(null); 
		});

	}

	/**
 	 * Get best nearby neighbourhood venues data from foursquare API,
 	 * retrieve and set foursquare venue photos in each venue object
 	 * create venues markers on map
 	 * @return {void}
 	 */
 	function getFoursquareData() {

		var foursquareBaseURL = 'https://api.foursquare.com/v2/venues/explore?';
  		var foursquareID = 'client_id=FQ0U4ULXEIUH35IVGSWWVXRNXSIYVOTL4OVCJE3U5DZV1ZGF&client_secret=KVV5QMBN02SXDTOFTVEANCBG1SKJSN5OVIYMDAJDYA05VMM2';
  		var neighbourhoodLL = '&ll=' + placeLat + ',' + placeLon;
  		var query = '&query=';
  		if (self.selectedVenueType() !== undefined)
  		{
  			query = '&query=' + self.selectedVenueType();
  		}

  		
  		var foursquareURL = foursquareBaseURL + foursquareID + '&v=20130815&venuePhotos=1' + neighbourhoodLL + query;

  		$.ajax({
  			url: foursquareURL, 
  			//timeout: 15000,
			//cache: false,
  			success: function(data) {

  				var initialFoursquareData = data.response.groups[0].items;

  				// retrieve and set foursquare venue data in topPicks observable array
  				initialFoursquareData.forEach(function(venueItem) {
  					self.topPicks.push( new Venue(venueItem, foursquareID) );
  				});

				
				// retrieve and set foursquare venue photos 
				// set marker for each venue
				self.topPicks().forEach(function(venueItem) { 
					setPhotoAlbumns(venueItem);
					createVenueMarker(venueItem);
				});

				// set bounds according to suggestedBounds from foursquare data resonse
				var tempBounds = data.response.suggestedBounds;
				if (tempBounds !== undefined) {
					bounds = new google.maps.LatLngBounds(
						new google.maps.LatLng(tempBounds.sw.lat, tempBounds.sw.lng),
						new google.maps.LatLng(tempBounds.ne.lat, tempBounds.ne.lng));
					map.fitBounds(bounds);
				}
			},
			complete: function() {
				if(self.topPicks().length === 0)
				 	$('#foursquare-API-error').html('<h2>No result available.</h2><h2>Please change your keywords.</h2>');
			},
      		error: function( data ) {
      			$('#foursquare-API-error').html('<h2>There are errors when retrieving venue data. Please try refresh page later.</h2>');
      		}	     		
		});
	}
 
	/**
 	 * set venue photos groups for swipebox lightbox display
 	 * @param {Object} venue A venue object 
 	 * @return {void}
 	 */
 	 function setPhotoAlbumns (venueItem) {

		var baseImgURL = 'https://irs3.4sqi.net/img/general/'; // base url to retrieve venue photos

		$.ajax({
			url: venueItem.photoAlbumnURL,
			dataType: 'jsonp',
			success: function(data) {

				var imgItems = data.response.photos.items;

				// set venu photo data in venue photo albumn
				for (var i in imgItems) {
					var venueImgURL = baseImgURL + 'width800' + imgItems[i].suffix;
					var venueImgObj = {
						href: venueImgURL,
						title: venueItem.name
					};
					// push venue photo data object to venue photo albumn
					venueItem.photoAlbumn.push(venueImgObj);
				}
			},
			// error handling
      		error: function( data ) {
      			$('#foursquare-API-error').html('<h2>There are errors when retrieving venue photo albumns. Please try refresh page later.</h2>');
      		}
		});

  		var venueAlbumnID = '#' + venueItem.id;
  		
  		// setup swipebox photo groups click function
		$(venueAlbumnID).click(function( e ) {
			e.preventDefault();
			$.swipebox(venueItem.photoAlbumn);
		});
	}


	/**
 	 * set a venue's marker infowindow
 	 * error handlings if no data is found
	 * @param {Object} venue A venue object 
 	 * @return {void}
 	 */
	function setVenueInfowindowStr(venue) {

		// set venue info window string
		var contentString = '<div class="venue-infowindow">' 
							+ '<div class="venue-name">'
							+ '<a href ="' + venue.foursquareUrl + '">'
							+ venue.name
							+ '</a>'
							+ '<span class="venue-rating badge">'
							+ venue.rating
							+ '</span>'
							+ '</div>'
							+ '<div class="venue-category"><span class="glyphicon glyphicon-tag"></span>'
							+ venue.categories
							+ '</div>'
							+ '<div class="venue-address"><span class="glyphicon glyphicon-home"></span>'
							+ venue.formattedAddress
							+ '</div>'
							+ '<div class="venue-contact"><span class="glyphicon glyphicon-earphone"></span>'
							+ venue.formattedPhone
							+ '</div>'  
							+ '<div class="venue-url"><span class="glyphicon glyphicon-globe"></span>'
							+ venue.url
							+ '</div>'  						    						    						
							+ '</div>';

		return	contentString;

	}

	/**
 	 * create a venue marker on map
 	 * when this venue marker is clicked on map, 
 	 * open marker infowindow, set marker bounce animation
 	 * scroll to this venue item on venues list,
 	 * panto this marker on map
	 * @param {Object} venue A venue object 
 	 * @return {void}
 	 */
	function createVenueMarker(venue) {

		// save venue info window content in a var
		var venueInfowindowStr = setVenueInfowindowStr(venue);

		var venuePosition = new google.maps.LatLng(venue.lat, venue.lon);

		// create marker data
		var venueMarker = new google.maps.Marker({
		  	map: map,
		  	position: venuePosition,
		  	title: venue.name
		});
	    
	    // set marker click event
		google.maps.event.addListener(venueMarker, 'click', function() {
	    	
	    	// if this marker is clicked, scroll to this venue info in the venue listing window
			document.getElementById(venue.id).scrollIntoView();
			var clickEvent = jQuery.Event('click');
			clickEvent.stopPropagation();
			// trigger this venue's click event
			$('#' + venue.id).closest(".venue-listing-item").trigger('clickEvent');
			// set this venue id as selected venue
			self.selectedVenue(venue.id);
			// set info window content
			infowindow.setContent(venueInfowindowStr);
			// open info window if this marker is clicked
			infowindow.open(map, venueMarker);
			// set marker animation to bounce if this marker is clicked
			selectedMarkerBounce(venueMarker);
			// pan to this venue's position if this marker is clicked 
			map.panTo(venuePosition);
		});

		// set marker info in passed venue object 
		venue.marker = venueMarker;

	}

	/**
 	 * if this marker has no animation, disable other marker's animation
 	 * set this marker's animation to bounce
	 * @param {Object} venueMarker A venue marker object 
 	 * @return {void}
 	 */
	function selectedMarkerBounce(venueMarker) {
		// if this venue marker has no animation
		if (venueMarker.getAnimation() == null) {
			// set this marker as selected marker
			self.selectedMarker(venueMarker);
			// disable other venue's animation
			self.topPicks().forEach(function(venue) {
				venue.marker.setAnimation(null);
			});
			// set this marker's aniamtion to bounce
			venueMarker.setAnimation(google.maps.Animation.BOUNCE);
		}
	}

	// callback(results, status) makes sure the search returned results for a location.
	// if so, get and update neighbourhood venues 
	function getneighbourhoodCallback(results, status) {


		if (status != google.maps.places.PlacesServiceStatus.OK) {
    		$('#googleMap-API-error').html('<h2>There are errors when retrieving map data.</h2><h2>Please try refresh page later.</h2>'); 
    		return;
  		}

		if (status == google.maps.places.PlacesServiceStatus.OK) {

			getneighbourhoodVenues(results[0]);

	    }
	}

	/**
 	 * get neighbourhood data for the app
 	 * this function gets called when explore keywords or 
 	 * neighbourhood location gets updates
	 * @param {string} neighbourhood A neighbourhood location retrieved from user input
 	 * @return {void}
 	 */
	function getneighbourhood(neighbourhood) {

		// the search request object
		var request = {
			query: neighbourhood
		};

		// creates a Google place search service object. 
		// PlacesService does the work of searching for location data.
		service = new google.maps.places.PlacesService(map);
		// searches the Google Maps API for location data and runs the callback 
		// function with the search results after each search.
		service.textSearch(request, getneighbourhoodCallback);

	}

	// initliaze neighbourhood data when application is load
	function initializeneighbourhood(neighbourhood) {
		getneighbourhood(neighbourhood);
	}

	// function that initializes the application map
	function initializeMap() {

		mapOptions = {
			zoom: 15,
			disableDefaultUI: true
		};

		if (typeof google == 'undefined') {
        	$('#googleMap-API-error').html('<h2>There are errors when retrieving map data.</h2><h2>Please try refresh page later.</h2>'); 
    		return;
    	}

		map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
		
		$('#map-canvas').height($(window).height());

	};

	// the map bounds is updated when page resizes
	window.addEventListener('resize', function(e) {
    	
		map.fitBounds(bounds);
    	
		$('#map-canvas').height($(window).height());
	});

	// initialize map
	initializeMap();

	// initialize neighbourhood
	initializeneighbourhood(defaultneighbourhood);

};

// initialize AppViewModel 
$(function() {

	ko.applyBindings(new AppViewModel());

});
