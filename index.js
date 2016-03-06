var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");
var {Cc,Ci,Cr} = require("chrome");
var config = require('sdk/simple-prefs');
var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

//
// observers 
 
// network requests
var httpRequestObserver = {
	
	observe: function(subject, topic, data) {
		
		subject.QueryInterface(Ci.nsIHttpChannel);          
		if (Util.matchRequest(subject.URI.spec)) {      

			if (config.prefs['cancelDefault'] || config.prefs['closeTab'])
				subject.cancel(Cr.NS_BINDING_ABORTED);

			Util.execRequest(subject.URI.spec);                                 
			if (config.prefs['closeTab'])
				tabs.activeTab.close();
		}
	}
};

// shutdown
var shutdownObserver = {

	observe : function(aSubject, aTopic, aData) {
		
		if (active)
			observerService.removeObserver(httpRequestObserver, "http-on-modify-request");
		
		observerService.removeObserver(this, "quit-application");
		config.prefs['active'] = active;
	}
};
 
//
// utils
 
var Util = {

	matchRequest: function(url) {
		
		var ext = config.prefs['uriExtensions'].replace(/,/g,"|");      
		if (!ext.length)
			return false;

		if (config.prefs['enableYoutube'])
			return (new RegExp("^([^\?]+)[.]("+ext+")([\?#]+.*)*|https:\\/\\/www\\.youtube\\.com\\/watch\\?v=.+$", "i")).test(url);
		else
			return (new RegExp("^([^\?]+)[.]("+ext+")([\?#]+.*)*$", "i")).test(url);
	},
	execRequest: function(url) {
	
		var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile); 
		file.initWithPath(config.prefs['executePath']);

		var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);      
		process.init(file);     
		process.run(false, [url], 1);
	}
};

function togglePlugin(activate) {
	
	if (activate) {     
		observerService.addObserver(httpRequestObserver, "http-on-modify-request", false);
		button.label = "Stop Video Assistant";
		button.icon = {
			"16": "./icon-16-red.png",
			"32": "./icon-32-red.png"       
		};      
	} else {        
		observerService.removeObserver(httpRequestObserver, "http-on-modify-request");
		button.label = "Start Video Assistant";
		button.icon = {
			"16": "./icon-16.png",
			"32": "./icon-32.png"       
		};      
	}
}
 
//
// main
 
var active = config.prefs['active']; 
var button = buttons.ActionButton({
 
	id: "activatetoggle",
	label: "Start Video Assistant",
	icon: {
		"16": "./icon-16.png",
		"32": "./icon-32.png"       
	},
	onClick: function(state) {
		active = !active;
		togglePlugin(active);       
	}
});
 
if (active) 
	togglePlugin(active);

observerService.addObserver(shutdownObserver, "quit-application", false); 