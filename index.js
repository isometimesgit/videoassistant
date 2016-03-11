"use strict";

var {ActionButton} = require('sdk/ui/button/action');
var {Cc,Ci,Cr} = require("chrome");
var tabs = require("sdk/tabs");
var config = require('sdk/simple-prefs');
var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
var plugin = ({
    requestObserver: {},
    shutdownObserver: {},
    active: false,
    button: null,
    // initialise plugin
    init: function() { 
        this.exp.build();
        config.on("uriExtensions", this.exp.build.bind(this.exp));
        config.on("enableYoutube", this.exp.build.bind(this.exp));     
        this.button = ActionButton({
            id: "activatetoggle",
            label: "Start Video Assistant",
            "icon": {
                "16": "./icon-16.png",
                "32": "./icon-16.png"     
            },
            onClick: this.onClickButton.bind(this)
        });
        this.shutdownObserver.observe = this.onShutdown.bind(this);
        this.requestObserver.observe = this.onRequest.bind(this);
        observerService.addObserver(this.shutdownObserver, "quit-application", false);  
        this.active = config['active'];
        if (this.active)
            this.activate(true);
        console.error('init');
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
        console.error('clicked');
    },
    // called when plugin is shutdown
    onShutdown: function(subject, topic, data) {  
        if (this.active) {
            observerService.removeObserver(this.requestObserver, "http-on-modify-request");
        }
        config.prefs["active"] = this.active;
        observerService.removeObserver(this.shutdownObserver, "quit-application");
        console.error('shutdown');
    },
    // called when a request is made
    onRequest: function(subject, topic, data) {  
        subject.QueryInterface(Ci.nsIHttpChannel);
        var url = subject.URI.spec;
        if (this.exp.test(url)) {      
            if (config.prefs["cancelDefault"] || config.prefs["closeTab"]) {
                subject.cancel(Cr.NS_BINDING_ABORTED);
            }                                         
            this.launchApp(url);
            if (config.prefs["closeTab"]) {
                tabs.activeTab.close();
            }
        }
        console.error('onRequest:'+url);
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
    // cache regular expression which tests urls with file extensions / hosts
    exp: {
        regex: null,
        build: function() {
            var ext = config.prefs["uriExtensions"].trim().replace(/,/g,"|");
            if (!ext.length) {
                return false;
            }
            if (config.prefs["enableYoutube"]) {
                this.regex = new RegExp("^([^\?]+)[.]("+ext+")([\?#]+.*)*|https:\\/\\/www\\.youtube\\.com\\/watch\\?v=.+$", "i");
            } else {
                this.regex = new RegExp("^([^\?]+)[.]("+ext+")([\?#]+.*)*$", "i");
            }
        },
        test: function(url) {
            return this.regex.test(url);       
        }
    }
}.init());
