"use strict";

var {ActionButton} = require('sdk/ui/button/action');
var {Cc,Ci,Cr} = require("chrome");
var tabs = require("sdk/tabs");
var config = require('sdk/simple-prefs');
var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
RegExp.escape = function(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};
var plugin = ({
    requestObserver: {},
    shutdownObserver: {},
    active: false,
    button: null,
    // initialise plugin
    init: function() { 
        this.extensions.build();
        this.blacklist.build();
        this.urlMatch.build();
        config.on("uriExtensions", this.extensions.build.bind(this.extensions));
        config.on("enableUrlMatch", this.urlMatch.build.bind(this.urlMatch));
        config.on("urlMatch", this.urlMatch.build.bind(this.urlMatch));
        config.on("enableDomainBlacklist", this.blacklist.build.bind(this.blacklist));
        config.on("domainBlacklist", this.blacklist.build.bind(this.blacklist));
        this.active = config.prefs['active'];
        this.button = ActionButton({
            id: "activatetoggle",
            label: this.active ? "Stop Video Assistant" : "Start Video Assistant",
            "icon": {
                "16": this.active ? "./icon-16-red.png" : "./icon-16.png",
                "32": this.active ? "./icon-32-red.png" : "./icon-16.png"
            },
            onClick: this.onClickButton.bind(this)
        });
        this.shutdownObserver.observe = this.onShutdown.bind(this);
        this.requestObserver.observe = this.onRequest.bind(this);
        observerService.addObserver(this.shutdownObserver, "quit-application", false);  
        if (this.active)
            this.activate(true);
        return this;       
    },
    // called when toolbar button clicked
    onClickButton: function(state) {
        this.active = !this.active;
        this.button.label = this.active ? "Stop Video Assistant" : "Start Video Assistant";
        this.button.icon = {
            "16": this.active ? "./icon-16-red.png" : "./icon-16.png",
            "32": this.active ? "./icon-32-red.png" : "./icon-16.png"
        }   
        this.activate(this.active);
    },
    // called when plugin is shutdown
    onShutdown: function(subject, topic, data) {  
        if (this.active) {
            observerService.removeObserver(this.requestObserver, "http-on-modify-request");
        }
        config.prefs["active"] = this.active;
        observerService.removeObserver(this.shutdownObserver, "quit-application");
    },
    // called when a request is made
    onRequest: function(subject, topic, data) {  
        subject.QueryInterface(Ci.nsIHttpChannel);
        var url = subject.URI.spec;
        if (this.blacklist.test(url)) {            
            return;
        }
        if (this.extensions.test(url) || this.urlMatch.test(url)) {      
            if (config.prefs["cancelDefault"] || config.prefs["closeTab"]) {
                subject.cancel(Cr.NS_BINDING_ABORTED);
            }                                         
            this.launchApp(url);
            if (config.prefs["closeTab"]) {
                tabs.activeTab.close();
            }
        }
    },
    // start / stop plugin listening to requests
    activate: function(active) {
        if (active) {
            observerService.addObserver(this.requestObserver, "http-on-modify-request", false);
        } else {
            observerService.removeObserver(this.requestObserver, "http-on-modify-request");
        }
    },
    // launch media player / app with url
    launchApp: function(url){
        try {
            var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile); 
            file.initWithPath(config.prefs['executePath']);
            var ps = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);      
            ps.init(file);     
            ps.run(false, [url], 1);
        } catch(ex) {
            console.error("Error launching app("+config.prefs['executePath']+") with url("+url+"): "+ex.message);
        }
    },
    // url path extensions / youtube
    extensions: {
        regex: null,
        build: function() {
            var ext = RegExp.escape(config.prefs["uriExtensions"]).trim().replace(/,/g,"|");
            if (ext.length) {
                this.regex = new RegExp("^([^\?]+)[.]("+ext+")([\?#]+.*)*$", "i");
            } else {
                this.regex = null;
            }
        },
        test: function(url) {
            return this.regex && this.regex.test(url);       
        }
    },
    // blacklisted domains
    blacklist: {
        regex: null,
        build: function() {
            var domains = RegExp.escape(config.prefs["domainBlacklist"]).trim().replace(/,/g,"|");
            if (config.prefs["enableDomainBlacklist"] && domains.length) {
                this.regex = new RegExp("^((.*)[\./])?("+domains+")([:][0-9]+)?[/]+(.+)$", "i");    
            } else {
                this.regex = null;
            }           
        },
        test: function(url) {
            return this.regex && this.regex.test(url);   
        }
    },
    // pass through urls e.g. youtube.com/watch?v=, dailymotion/video/ etc
    urlMatch: {
        regex: null,
        build: function() {
            var urls = RegExp.escape(config.prefs["urlMatch"]).trim().replace(/,/g,"|");
            //console.error(urls);
            if (config.prefs["enableUrlMatch"] && urls.length) {
                this.regex = new RegExp("^(https?:\\/\\/)?("+urls+").*$", "i");    
            } else {
                this.regex = null;
            }           
        },
        test: function(url) {
            //console.error('testing: '+url+':'+this.regex.source+':'+this.regex.test(url));
            return this.regex && this.regex.test(url);   
        }  
    }
}.init());
