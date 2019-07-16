var defaultOpts = {
		keyhigh:	true,
		filters: {		
			xurl:	["ecosia.org/images", "dogpile.*qc=images"],
			xsub:	["mail.google","maps.google"],
			url:	["stackoverflow.com/search", "www.google.com/search", "app.getpocket.com/search"],
			sub:	[],
			dom:	["ask","baidu","bing","dogpile","ecosia","yahoo"]
		},
		minwhere: {
			url: new Set(),
			sub: new Set(),
			dom: new Set()
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

//SPlit in sub- and domain
//DIFFICULT bc of these:! 1. if no subdomain! 2. if of form (sub.)xxx.co.uk 3.many more!
//BAse on sidanmor answer -> https://stackoverflow.com/questions/9752963/get-domain-name-without-subdomains-using-javascript

const TLD2  = ["ac","ad","ae","af","ag","ai","al","am","an","ao","aq","ar","as","at","au","aw","ax","az","ba","bb","be","bf","bg","bh","bi","bj","bm","bo","br","bs","bt","bv","bw","by","bz","ca","cc","cd","cf","cg","ch","ci","cl","cm","cn","co","cr","cu","cv","cw","cx","cz","de","dj","dk","dm","do","dz","ec","ee","eg","es","et","eu","fi","fm","fo","fr","ga","gb","gd","ge","gf","gg","gh","gi","gl","gm","gn","gp","gq","gr","gs","gt","gw","gy","hk","hm","hn","hr","ht","hu","id","ie","im","in","io","iq","ir","is","it","je","jo","jp","kg","ki","km","kn","kp","kr","ky","kz","la","lb","lc","li","lk","lr","ls","lt","lu","lv","ly","ma","mc","md","me","mg","mh","mk","ml","mn","mo","mp","mq","mr","ms","mt","mu","mv","mw","mx","my","na","nc","ne","nf","ng","nl","no","nr","nu","nz","om","pa","pe","pf","ph","pk","pl","pm","pn","pr","ps","pt","pw","py","qa","re","ro","rs","ru","rw","sa","sb","sc","sd","se","sg","sh","si","sj","sk","sl","sm","sn","so","sr","st","su","sv","sx","sy","sz","tc","td","tf","tg","th","tj","tk","tl","tm","tn","to","tp","tr","tt","tv","tw","tz","ua","ug","uk","us","uy","uz","va","vc","ve","vg","vi","vn","vu","wf","ws","yt"]
const TLD3 = ["com","edu","gov","net","mil","org","nom","sch","caa","res","off","gob","int","tur","ip6","uri","urn","asn","act","nsw","qld","tas","vic","pro","biz","adm","adv","agr","arq","art","ato","bio","bmd","cim","cng","cnt","ecn","eco","emp","eng","esp","etc","eti","far","fnd","fot","fst","g12","ggf","imb","ind","inf","jor","jus","leg","lel","mat","med","mus","not","ntr","odo","ppg","psc","psi","qsl","rec","slg","srv","teo","tmp","trd","vet","zlg","web","ltd","sld","pol","fin","k12","lib","pri","aip","fie","eun","sci","prd","cci","pvt","mod","idv","rel","sex","gen","nic","abr","bas","cal","cam","emr","fvg","laz","lig","lom","mar","mol","pmn","pug","sar","sic","taa","tos","umb","vao","vda","ven","mie","北海道","和歌山","神奈川","鹿児島","ass","rep","tra","per","ngo","soc","grp","plc","its","air","and","bus","can","ddr","jfk","mad","nrw","nyc","ski","spy","tcm","ulm","usa","war","fhs","vgs","dep","eid","fet","fla","flå","gol","hof","hol","sel","vik","cri","iwi","ing","abo","fam","gok","gon","gop","gos","aid","atm","gsm","sos","elk","waw","est","aca","bar","cpa","jur","law","sec","plo","www","bir","cbg","jar","khv","msk","nov","nsk","ptz","rnd","spb","stv","tom","tsk","udm","vrn","cmw","kms","nkz","snz","pub","fhv","red","ens","nat","rns","rnu","bbs","tel","bel","kep","nhs","dni","fed","isa","nsn","gub","e12","tec","орг","обр","упр","alt","nis","jpn","mex","ath","iki","nid","gda","inc"]

var splitDom = function (u) {

   let parts = u.hostname.split('.')
   u.subdomain = ""

    while (parts.length > 3) {
    	u.subdomain += parts.shift()
    }

    if (parts.length === 3 && ((parts[1].length > 2 && parts[2].length > 2) || (TLD3.indexOf(parts[1]) === -1) && TLD2.indexOf(parts[2]) === -1)) {
    	u.subdomain += parts.shift()
    }

   u.domain = parts.join('.')
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
	//Ignore frame and ajax 
	if (o.frameId!=0) return
	
	browser.tabs.get(o.tabId, t=>{										//console.log("navCompleted - TAB: ", t)
		if (myTabs.has(t.id)) {
			t = myTabs.get(t.id)
			t.refresh(o.url)
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
		myTabs.set(tab.id,this)
		this.id 		= tab.id
		this.refresh(tab.url)
	}
	
	refresh(u) {
		this.url		= u
		this.uri		= new URL(this.url)
		splitDom(this.uri)
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
		//For url has to be whole url here, because of google images (in request part), in contrast to filterSet, which only takes hostname + pathname
		this.filterUrl("dom", true,		this.uri.domain)
		this.filterUrl("sub", true,		this.uri.hostname)
		this.filterUrl("url", true, 	this.url)
		this.filterUrl("sub", false,	this.uri.hostname)
		this.filterUrl("url", false,	this.url)
		//Manually disabled or enabled on his tab
		if (this.filters.tab===false)
			this.filterResult = false
		else if (this.filters.tab===true) {
			this.filterResult = "tab"
		}
		return this.filterResult
	}

	filterUrl(fType, incl, urlPart) {
		//reset old resolutions
		let oFName = (incl?"":"x") + fType										//;console.log(oFName, incl, this.url)
		if ( opts.filters[oFName].length ) 
			for ( const [i,rule] of opts.filters[oFName].entries() ) {			//console.log(i, rule)
				//rule can be undefined if array empty slots!!
				if (rule && RegExp(rule, 'i').test(urlPart)) {
					this.filters[fType]			= incl
					//To be able to delete it
					this.filterPosition[fType]	= i
					//To know the result and who was responsible for enabling script:
					this.filterResult			= incl?fType:false				//;console.log('\tfilter match',  this.filterResult)
					return incl
				}
			}
	}
	
	filterSet(fType, value) {													//console.log("fiterSet",fType, value, this.filterPosition, this.CSEnabled)

		if (fType == "tab") {
			this.filters.tab=value=="yes"?true:(value=="no"?false:undefined)	
		}
		//unset -> yes -> no -> unset
		else if (value == "yes" || value == "no") {								//console.log(this.uri)
			let n		= false
			if (value == "yes") {	
				if		(fType == "sub" && this.uri.subdomain)
					n = this.uri.hostname
				else if	(fType == "dom")
					n = this.uri.domain
				else if	(fType == "url")
					n = this.uri.hostname + this.uri.pathname
				if (n) {
					opts.filters[fType].push(n)
				}
			}
			else if (value == "no") {
				if		(fType == "sub" && this.filterPosition[fType]>=0) {
					opts.filters[fType].splice(this.filterPosition[fType],1)
					if (this.uri.subdomain)
					n = this.uri.hostname
				}
				//No for dom does not exist, go to unset
				else if	(fType == "dom" && this.filterPosition[fType]>=0) {
					opts.filters[fType].splice(this.filterPosition[fType],1)
				}
				else if	(fType == "url" && this.filterPosition[fType]>=0) {
					opts.filters[fType].splice(this.filterPosition[fType],1)
					n = this.uri.hostname + this.uri.pathname
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
	
	minimize(o, t) {
		
		opts.minwhere[t.filterResult].add(t.filterPosition[t.filterResult])
		
		//store options!
		browser.storage.local.set(opts)
	}
	
	maximize(o, t) {
		
		opts.minwhere[t.filterResult].delete(t.filterPosition[t.filterResult])
		
		//store options!
		browser.storage.local.set(opts)
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
	
	CSConnect(p) {												//console.log(`Content script connected`, p, opts)
		
		this.CSPort = p
		//For methods that can't get 'this'
		p.parent = this
		p.onMessage.addListener(this.onMsg)
		p.onDisconnect.addListener(this.CSDisconnect)
		
		//Start!
		p.postMessage({fn: "setOpts", keyhigh:opts.keyhigh, viewMin:opts.minwhere[this.filterResult].has(this.filterPosition[this.filterResult])})
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