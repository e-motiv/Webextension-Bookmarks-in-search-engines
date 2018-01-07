//var iconMain = self.options.iconMain;
console.log("MATCH!");
//For now just google, later refine other SEs


//Get URI variables
function getGet(capture) {
	let vars= {};
	if(capture.length==0) return false;
	capture.replace(/[?#&]+([^=&]+)=([^&]*)/gi, function(m,key,value){					console.log(m, key, value);
		key=decodeURIComponent(key);
		if(typeof vars[key]==="undefined") {vars[key]= decodeURIComponent(value);}
			else {vars[key]= [].concat(vars[key], decodeURIComponent(value));}
	});
	return vars;
}
//Listen for ajax searches. Listening for DOM changes isn't enough as other UI gadgets (tooltips, ..) can trigger those.
//Code below doesn't work.
console.log(XMLHttpRequest == undefined);
/*
(function() { // Overriding XMLHttpRequest
    var oldXHR = window.XMLHttpRequest;
 
    function newXHR() {
        var realXHR = new oldXHR();
 
        realXHR.addEventListener("readystatechange", function() { 
            console.log("an ajax request was made");
        }, false);
 
        return realXHR;
    }
 
    window.XMLHttpRequest = newXHR;
})();

XMLHttpRequest.prototype.realSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(value) {
    this.addEventListener("progress", function(){
        console.log("Loading");
    }, false);
    this.realSend(value);
};
*/
use hashchange for ajax detect? Since only google uses ajax apparenlty and then a haschange is enough
//Get URL parameters. Note:Google sometimes uses anchor (hash)
const querySearch = "q";		

//try hash
let queryPs = getGet(window.location.hash);
let keywords;
if (!(querySearch in queryPs)) {
	//try get
	queryPs=getGet(window.location.search);					console.log(window.location.hash, window.location.search);
}
//No search, show that addon is active and ready
if (!(queryPs && queryPs[querySearch])) {						console.log("Bookmarksise ready and waiting");
	document.body.innerHTML += '<div id="icon">&nbsp;</div>';
	exit("No query parameter found");
} 
//Search has been done, 
else {															console.log("Bookmarksise starts searching");
	//Ask sdk to fetch bookmarks
	keywords=queryPs[querySearch].split();
	addon.port.emit("search", keywords);	
}

//SDK main finished, show searching and results
addon.port.on("search-results", function(htmlResults) {				console.log("Search results received in content-script:", results);
	document.body.innerHTML +=	'<div id="bookmarksise"><h2><span class="icon">&nbsp;</span>Bookmarks search results</h2>	<div class="results">'
							+	htmlResults
							+	'</div></div>';
	//Replace ALL terms here with colors, from search engine as well as from our add-on
	document.body.replace(keywords, map(keywords, (v,i) => v='<b class="hit'+i+'">'+v+'</b>'));
	//ToDo: Find bookmarks that are also in search engine results
});
//SDK main search error
addon.port.on("search-error", function(reason) {				console.log("Search error received in content-script:", reason);
	document.body.innerHTML += "Bookmark search error<br>"+reason;
});


