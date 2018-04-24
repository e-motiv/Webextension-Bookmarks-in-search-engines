var defaultOpts = {
		keyhigh:	true,
		filters: {		
			xurl:	[],
			xsub:	["mail.google","maps.google"],
			url:	["google(?!.*\/(?:maps|mail)\/).*", "stackoverflow.com/search"],
			sub:	[],
			dom:	["ask","baidu","bing","dogpile","ecosia","yahoo"],
		}
	},
	opts,
	popPort,
	myTabs			= new Map()

 function notify(m, type, t = 20000, id) {
	if (type=="error") {
		console.error(m)
		m = "Sorry, but something went wrong.\n\n" + m
	} else if (type=="warning") {
		console.error(m)
		m = "Something didn't work. This could be a bug or you might be doing something I'm not programmed for.\n\n" + m
	}
	id = String(Date.now());
	
	browser.notifications.create(id, {
	    type: 'basic',
	    iconUrl: '/search-bookmarked32.png',
	    title: "Bookmarks in search engines",
	    message: String(m),
	});
	
	setTimeout(browser.notifications.clear, t, id);
}

/************* OPTIONS *********************************
 *******************************************************/

optsGetAndListen()
browser.webNavigation.onCompleted.addListener(navCompleted)
browser.tabs.onRemoved.addListener(tabFinish)
browser.runtime.onConnect.addListener(connected)

function optsGetAndListen() {										//console.log("optsGetAndListen, opts:", opts)
	
	return browser.storage.local.get()
		.then(optsSet, optsError)
}
function optsSet(result) {											//console.log("optsSet before, opts:", opts, "defaults:", defaultOpts, "result:",result)
	
	//Very important for if new options appear after updating addon on user machine
	if ( result )
		//Fill in possible unexisting options, like after update of extension
		opts = Object.assign({}, defaultOpts, result);
	//update content scripts options or leave it upto the user when to do that?
/*	if(CSPorts.length) CSPorts.forEach(p => {
		p.postMessage({fn: "setOpts", opts:opts})
	})*/
																	//console.log("optsSet after, opts:", opts, "defaults:", defaultOpts)
}
function optsError(e) {
	notify(`Error while getting options: ${e}`,'error')
}
function optsStore(o) {														//console.log("BG storeOptions", o)

	return browser.storage.local.set(o)
			.then(optsGetAndListen, null)
}

/************* PORTS & ACTIVATION **********************
 *******************************************************/
function navCompleted(o) {
	browser.tabs.get(o.tabId, t=>{												//console.log("navCompleted: ", o, t)
		if (myTabs.has(t.id)) {
			t = myTabs.get(t.id)
			t.url = o.url
		}
		else
			t = tabInit(t)
		if (t.filterResult)
			t.CSStart(o.frameId)
	})
}


//webext new connection with content scripts
function connected(p) {												//console.log("Connection from CS received:",p) //p.sender.contextId ids the exact tab
	//Content Script
	if (p.sender.envType=="content_child") {
		myTabs.get(p.sender.tab.id).CSConnect(p)
	}
	//Popup script
	else  {
		popPort	= p
		p.onDisconnect.addListener(popDisconnect)
	}
}

function popDisconnect(p) {												//console.log(`PopUp disconnected`, p)

	popPort = false
	}

function updatePopUp() {												//console.log(`updatePopUp`, popPort)
	if (popPort)
		popPort.postMessage({fn: "updateFilters"})
}


/**************** Tab specific ***************************
 **********************************************************/


function tabInit(o) {														//console.log("tabInit", o)
	let mTab = new myTab(o)
	myTabs.set(o.id,mTab)
	return mTab
}
//CLEANUP when tab closed
function tabFinish(id) {													//console.log("tabFinish",id)
	if (myTabs.has(id)) {
		myTabs.delete(id)
	}
}
class myTab {
	constructor(tab) {
		this.id 		= tab.id
		this.url		= tab.url
		this.CSEnabled	= false
		
		this.filtersResolve()
	}

	filtersResolve(o) {

		this.filterResult	= null
		this.filterPosition	= {}

		//clean all but tab filter if exist
		if (this.filters && this.filters.tab!==undefined) {
			let temp=this.filters.tab
			this.filters = {}
			this.filters.tab = temp
		} else 
			this.filters = {}
			
		//order in the lines below determines priority!								
		this.filterUrl("dom", true)
		this.filterUrl("sub", true)
		this.filterUrl("url", true)
		this.filterUrl("sub", false)
		this.filterUrl("url", false)
		//Manually disabled or enabled on his tab
		if (this.filters.tab===false)
			this.filterResult = false
		else if (this.filters.tab===true) {
			this.filterResult = "tab"
		}
		return this.filterResult
	}

	filterUrl(fType, incl) {
		//reset old resolutions
		let oFName = (incl?"":"x") + fType										//;console.log(oFName, incl, this.url)
		if ( opts.filters[oFName].length ) 
			for ( const [i,rule] of opts.filters[oFName].entries() ) {			//console.log(i, rule)
				//rule can be undefined if array empty slots!!
				if (rule && RegExp(rule, 'i').test(this.url)) {
					this.filters[fType]			= incl
					//To be able to delete it
					this.filterPosition[fType]	= i
					//To know the result and who was responsible for enabling script:
					this.filterResult			= incl?fType:false				//;console.log('\tfilter match', i, rule,  this.filterResult)
					return incl
				}
			}
	}
	
	filterSet(fType, value) {															//console.log("fiterSet",fType, value, this.filterPosition, this.CSEnabled)
		if (fType == "tab") {
			this.filters.tab=value=="yes"?true:(value=="no"?false:undefined)	
		}
		//unset -> yes -> no -> unset
		else if (value == "yes" || value == "no") {
			let uri		= new URL(this.url)
			let doms	= /([^\.]+)*\.([^\.]+\.[^\.]+)/.exec(uri.hostname)
			let n = false
			if (value == "yes") {	
				if		(fType == "sub" && doms[1])
					n = uri.hostname
				else if	(fType == "dom")
					n = doms[2]
				else if	(fType == "url")
					n = uri.hostname + uri.pathname
				if (n) {
					opts.filters[fType].push(n)
				}
			}
			else if (value == "no") {
				if		(fType == "sub" && this.filterPosition[fType]>=0) {
					opts.filters[fType].splice(this.filterPosition[fType],1)
					if (doms[1])
					n = uri.hostname
				}
				//No for dom does not exist, go to unset
				else if	(fType == "dom" && this.filterPosition[fType]>=0) {
					opts.filters[fType].splice(this.filterPosition[fType],1)
				}
				else if	(fType == "url" && this.filterPosition[fType]>=0) {
					opts.filters[fType].splice(this.filterPosition[fType],1)
					n = uri.hostname + uri.pathname
				}
				if (n) {
					opts.filters["x" + fType].push(n)
				}
			}
			if(!n && !(fType == "dom" && value=="no"))
				notify("Couldn't grab the neccesary parts of the URI.","warning")
		}
		else if (value == "unset" && this.filterPosition[fType]>=0) {
			opts.filters["x" + fType].splice(this.filterPosition[fType],1)
		}
		else 
			notify("Got a filter request without the necessary parameters.","error")

		//store options!
		optsStore(opts)
		
		//Re-resolve filters
		this.filtersResolve()												//;console.log("After filtersResolve",this.CSEnabled, this.filterResult, this.filters)
		
		//post to popup back here, before enabling disabling, feels user most friendly
		updatePopUp()
																		//console.log(this.CSEnabled, this.filterResult)
		//Enable or disable content script on page	
		if (this.CSEnabled && !this.filterResult) {
			if (this.CSPort)
				this.CSPort.postMessage({fn: "viewRemove"})
			//else msg somehing's wrong
		}
		//enable on this tab
		else if (!this.CSEnabled && this.filterResult) {
			//if script already there, reInitiate, else inject
			if (this.CSPort) {
				this.CSPort.postMessage({fn: "viewAdd"})
				this.CSPort.postMessage({fn: "searchBasic"})				
			}
			else {
				//TODO: Only if there is a web-page (e.g. when page not found, we cannot insert css or js) // no api solutions yet
				this.CSStart()
			}
		} 
				
	}
	
	/*************** Content SCript **************************
	 **********************************************************/
	
	CSStart(frameId=null) {												//console.log("CSStart: ", frameId)	

		//Don't launch on background scripts that are loaded inside a frame, nor where already injected
		if (frameId > 0 && !this.CSPort)
			return
		browser.tabs.insertCSS(this.id, 	{file: "displayOnPage.css"	})
	  		.then(null, e=>{console.error(`Insert CSS: ${e}`)})
	  	browser.tabs.executeScript(this.id,	{file: "displayOnPage.js"	})
	  		.then(null, e=>{console.error(`Insert JS: ${e}`)})	
	}
	
	CSConnect(p) {												//console.log(`Content script connected`, p)
		
		this.CSPort = p
		//For methods that can't get 'this'
		p.parent = this
		p.onMessage.addListener(this.onMsg)
		p.onDisconnect.addListener(this.CSDisconnect)
	
		//Start!
		p.postMessage({fn: "setOpts", keyhigh:opts.keyhigh})
	}
	
	CSDisconnect(p) {											//console.log(`Content script disconnected`, p.parent)

		p.parent.CSPort = false
	}
	
	onMsg(m,p) {														//console.log("Message from CS received:",m,p)

		if(m.searchType)
			p.parent.currentSearch = m.searchType
			  
		let fn = p.parent[m.fn]
		if (typeof fn === "function") fn(m,p.parent)
		else notify('error',m.fn + " is not a method inside myTab")
		
	}

	CSAfterEnabled(o,t) {												//console.log(o, t)

		t.CSEnabled = true
		t.filters[t.filterResult]=true
		browser.browserAction.setBadgeText({text:"✔",tabId:t.id})
		browser.browserAction.setBadgeBackgroundColor({color:"hsla(180, 100%, 50%, 0.5)",tabId:t.id})
		updatePopUp()
	}

	CSAfterDisabled(o,t) {											//console.log(o, t)

		t.CSEnabled = false
		browser.browserAction.setBadgeText({text:"",tabId:t.id})
		//If closed from within the page our view
		if (o.fromView) {
			t.filters.tab	= false
			t.filterResult	= false
		}
		updatePopUp()
		
	}
	

	/*************** SEARCH LOGIC ****************************/

	searchBasic(o, t) {									//console.log("Main script searching", o.keywords)
		
		//splitIns[tabId]	= true;
		browser.bookmarks.search(o.keywords)
			.then(bms => t.searchBTest(bms, o.keywords), e => t.searchRejected(e))
	}

	searchBTest(bms, kws) {								//console.log("searchBTest", bms)

		//Nothing found and can't search for less keywords
		if(bms.length>0)			// || splitIns[tabId]<1
			this.searchFinished(bms)

		//Start split searching
		else {
			this.keywords = kws.split(/\s+/)
			if (this.keywords.length<2)
				this.searchFinished(bms)
			//splitIns[tabId] = keywords.length
			this.searchBSplit()
		}
	}
	
	searchBSplit(){									//console.log("searchBSplit", this.keywords)
		
		/*//No more spits
		if(!--splitIns[tabId]){
			searchFinished(tabId, 0)
			return
		}*/
		//split keywords up
		let splits = []
		this.keywords.forEach( (k, i, a) => {						//console.log(k, i, a, a.slice(), a.slice().splice(i,1))
			let nA	= a.slice()
			nA.splice(i,1)
			splits.push(nA)								
		})
		//count number of searchers x, can't this be derived from spitIns?
		this.splitSLefts	= splits.length
		this.bmsJoins		= []
		//do x bookmarks searches
		splits.forEach(kws => {
			browser.bookmarks.search(kws.join(" "))
				.then(bms => this.searchBWaitAll(bms), e => this.searchRejected(e))
		})
	}
	
	searchBWaitAll(bms) {								//console.log("searchBWaitAll", bms, this.bmsJoins,  this.splitSLefts)
		//join results
		this.bmsJoins = this.bmsJoins.concat(bms)
		//All searches done?
		if( !--this.splitSLefts) 
			//if (this.bmsJoins.length) {
				if (this.CSPort)
					this.CSPort.postMessage({fn: "showBasicResults", bms:this.bmsJoins, searchType:this.currentSearch, split:true})
			//}
	}

	searchFinished(bms) {							//console.log("Bookmarks search finished",bms, this.currentSearch, this.CSPort)
		if(this.CSPort)
			this.CSPort.postMessage({fn: this.currentSearch==1?"showBasicResults":"showUrlResult", bms:bms, searchType:this.currentSearch})
	}

	searchRejected(e) {
		
		notify('error',`Bookmark search error: ${e}`)
		if(this.CSPort)
			this.CSPort.postMessage({fn: "searchError", e:e, searchType:this.currentSearch})
	}

	//must be starting with valid protocol e.g. http
	searchUrlBm(o, t) {											//console.log("searchUrlBm", o)
		
		//Use try not to break the url chain //DOESn't work tho, still breaks everything, use timer?
		//We have to create a different function for each tab, not very good, but well, no other solution
		try {
			browser.bookmarks.search({url:o.urls})
				.then(bms => t.searchFinished(bms), e => t.searchRejected(e))
		} catch (e) {
			t.searchRejected(e)
		}
	}
}