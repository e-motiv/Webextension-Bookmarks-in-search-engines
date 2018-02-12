/************* OPTIONS & ACTIVATION ********************
 *******************************************************/
var defaultOpts = {
		keyhigh:	true,
		hosts:		".google, .stackoverflow, .dogpile, .baidu, .bing, .ask, .ecosia, .yahoo"
	},
	opts,
	ports = [],
	currentSearches = []

function optsGetAndListen() {
	browser.storage.local.get()
		.then(optsSet, optsError)
}
function optsSet(result) {											//console.log("optsSet before, opts:", opts, "defaults:", defaultOpts, "result:",result)
	//ALWAYS PUT LAST NEW OPTION HERE, SO OPTIONS are reset: TODO later: reset only new options!
	if ( result && (result.hosts != undefined) )
		opts = result
	else
		opts = defaultOpts
	//update content scripts options
	if(ports.length) ports.forEach(p => {
		p.postMessage({fn: "setOpts", opts:opts})
	})
	
	//Create host match array
	let uHosts = []
	opts.hosts.split(",").forEach(h=>{
		uHosts.push({hostContains:h.trim()})
	})
																	//console.log("optsSet after, opts:", opts, "defaults:", defaultOpts, opts, "uHosts:", uHosts)
	//Listen and match for activation
	if (browser.webNavigation.onCompleted.hasListener(tabOnCompleted))
		browser.webNavigation.onCompleted.removeListener(tabOnCompleted)
	browser.webNavigation.onCompleted.addListener(tabOnCompleted, { url: uHosts })
}
function optsError(e) {
	console.error(`Error while getting options: ${e}`)
}
function tabOnCompleted(details) {										//console.log("onCompleted: ", details.url, details.tabId, details)

	//Don't launch on background scripts that are loaded inside a frame!	
	if (details.frameId > 0)
		return
	browser.tabs.insertCSS(details.tabId, 		{file: "displayOnPage.css"	})
  		.then(null, e=>{console.error(`Insert CSS: ${e}`)})
  	browser.tabs.executeScript(details.tabId,	{file: "displayOnPage.js"	})
  		.then(null, e=>{console.error(`Insert JS: ${e}`)})							//null or r=>{console.log(`We injected in tab`)}
}

optsGetAndListen()

/*************** Listen for CS connection *****************
 **********************************************************/

browser.runtime.onConnect.addListener(connected)
//webext new connection with content scripts
function connected(p) {												//console.log("Connection from CS received:",p) //p.sender.contextId ids the exact tab
	ports[p.sender.tab.id]	= p
	p.onMessage.addListener(messageExec)
	p.onDisconnect.addListener(disconnect)

	//Start!
	p.postMessage({fn: "setOpts", opts:opts})
}

function messageExec(m, p) {										//console.log("Message from CS received:",m,p)

	if(m.searchType)
		currentSearches[p.sender.tab.id] = m.searchType
	  
	let fn = window[m.fn]
	if (typeof fn === "function") fn(p.sender.tab.id, m.pms)
	else console.error(m.fn + " is not a function", fn)
}
function disconnect(p) {											//console.log(`Content script disconnected`, p.error, p)

	let i	= ports.indexOf(p.sender.tab.i)
	if (i)
		ports.splice(i, 1)
}

/*************** SEARCH LOGIC ****************************
 **********************************************************/

var splitSLefts = [], bmsJoins = [], keywords = []		//,splitIns=[] for when doing less and less keywords, now just minus 1

function searchBasic(tabId, keywords) {								//console.log("Main script searching", keywords)
	
	//splitIns[tabId]	= true;
	browser.bookmarks.search(keywords)
		.then(bms => searchBTest(tabId, bms, keywords), e => searchRejected(tabId, e))
}


function searchBTest(tabId, bms, kws) {

	//Nothing found and can't search for less keywords
	if(bms.length>0)			// || splitIns[tabId]<1
		searchFinished(tabId, bms)

	//Start split searching
	else {
		keywords[tabId] = kws.split(/\s+/)
		if (keywords[tabId].length<2)
			searchFinished(tabId, bms)
		//splitIns[tabId] = keywords.length
		searchBSplit(tabId)
	}
}
function searchBSplit(tabId){									//console.log("searchBSplit", keywords[tabId])
	
	/*//No more spits
	if(!--splitIns[tabId]){
		searchFinished(tabId, 0)
		return
	}*/
	//split keywords up
	let splits = []
	keywords[tabId].forEach( (k, i, a) => {						//console.log(k, i, a, a.slice(), a.slice().splice(i,1))
		let nA	= a.slice()
		nA.splice(i,1)
		splits.push(nA)								
	})
	//count number of searchers x, can't this be derived from spitIns?
	splitSLefts[tabId]	= splits.length
	bmsJoins[tabId]		= []
	//do x bookmarks searches
	splits.forEach(kws => {
		browser.bookmarks.search(kws.join(" "))
			.then(bms => searchBWaitAll(tabId, bms, kws), e => searchRejected(tabId, e))
	})
}
function searchBWaitAll(tabId, bms) {								//console.log("searchBWaitAll", bms, bmsJoins[tabId],  splitSLefts[tabId])
	//join results
	bmsJoins[tabId] = bmsJoins[tabId].concat(bms)
	//All searches done?
	if( !--splitSLefts[tabId]) 
		//if (bmsJoins[tabId].length) {
			if (ports[tabId])
				ports[tabId].postMessage({fn: "showBasicResults", bms:bmsJoins[tabId], searchType:currentSearches[tabId], split:true})
		//}
}

function searchFinished(tabId, bms) {						//console.log("Bookmarks search finished",bms)
	if(ports[tabId])
		ports[tabId].postMessage({fn: currentSearches[tabId]==1?"showBasicResults":"showUrlResult", bms:bms, searchType:currentSearches[tabId]})
}

function searchRejected(tabId, e) {
	
	console.e(`Bookmark search error: ${e}`)
	if(ports[tabId])
		ports[tabId].postMessage({fn: "searchError", e:e, searchType:currentSearches[tabId]})
}

//must be starting with valid protocol e.g. http
function searchUrlBm(tabId, url) {									//console.log("searchUrlBm", url)
	
	//Use try not to break the url chain //DOESn't work tho, still breaks everything, use timer?
	//We have to create a different function for each tab, not very good, but well, no other solution
	try {
		browser.bookmarks.search({url:url})
			.then(bms => searchFinished(tabId, bms), e => searchRejected(tabId, e))
	} catch (e) {
		searchRejected(tabId, e)
	}
}