"use strict";

var {ActionButton} = require('sdk/ui/button/action');
var {Cc,Ci,Cr} = require("chrome");
var tabs = require("sdk/tabs");
var config = require('sdk/simple-prefs');
var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

// flag indicating plugin is (de)activated
var active = config.prefs["active"];

// toolbar button to (de)activate plugin 
var button = ActionButton({
    id: "activatetoggle",
    label: active ? "Stop Video Assistant" : "Start Video Assistant",
    "icon":{
        "16": active ? "./icon-16-red.png" : "./icon-16.png",
        "32": active ? "./icon-32-red.png" : "./icon-16.png"     
    },
    onClick: function(state) {
        active = !active;
        activate(true);
    }
});
// cache regular expression which tests urls with file extensions / hosts
var regex = {
    expression: null,
    build: function() {
        var ext = config.prefs["uriExtensions"].trim().replace(/,/g,"|");
        if (!ext.length) {
            return false;
        }
        if (config.prefs["enableYoutube"]) {
            this.expression = new RegExp("^([^\?]+)[.]("+ext+")([\?#]+.*)*|https:\\/\\/www\\.youtube\\.com\\/watch\\?v=.+$", "i");
        } else {
            this.expression = new RegExp("^([^\?]+)[.]("+ext+")([\?#]+.*)*$", "i");
        }
    },
    test: function(url) {
        return this.expression.test(url);       
    }
};
//observers to listen for http requests / shutdown
var observers = {
    httpRequest: {
        observe: function(subject, topic, data) {  
            subject.QueryInterface(Ci.nsIHttpChannel);
            var url = subject.URI.spec;
            if (regex.test(url)) {      
                if (config.prefs["cancelDefault"] || config.prefs["closeTab"]) {
                    subject.cancel(Cr.NS_BINDING_ABORTED);
                }                                           
                if (config.prefs["closeTab"]) {
                    tabs.activeTab.close();
                }
                launchApp(url);
            }
        }
    },
    shutdown: {
        observe : function(aSubject, aTopic, aData) {  
            if (active) {
                observerService.removeObserver(observers.httpRequest, "http-on-modify-request");
            }
            config.prefs["active"] = active;
            observerService.removeObserver(this, "quit-application");
        }
    }
};    
//initialise the plugin
function init(){
    regex.build();
    config.on("uriExtensions", regex.build.bind(regex));
    config.on("enableYoutube", regex.build.bind(regex));     
    observerService.addObserver(observers.shutdown, "quit-application", false);         
    activate(false);
}
//launch app / media player
function launchApp(url){
    try {
        var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile); 
        file.initWithPath(config.prefs['executePath']);
        var ps = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);      
        ps.init(file);     
        ps.run(false, [url], 1);
    } catch(ex) {
        console.error("Error launching app("+config.prefs['executePath']+") with url("+url+"): "+ex.message);
    }
}
// (de)register observers modify toolbar icon
function activate(initialised){
    if (active) {
        observerService.addObserver(observers.httpRequest, "http-on-modify-request", false);
    } else if (initialised) {
        observerService.removeObserver(observers.httpRequest, "http-on-modify-request");
    }
    if (initialised) { 
        button.label = active ? "Stop Video Assistant" : "Start Video Assistant";
        button.icon = {
            "16": active ? "./icon-16-red.png" : "./icon-16.png",
            "32": active ? "./icon-32-red.png" : "./icon-16.png"     
        }
    }
}
init();