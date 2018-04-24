let	searchBox	= false,	
	lastSearch	= false,
	inProgress	= false,
	searchDelay	= false,
	justLoaded	= true,
	searchTerm	= false,
	urls, timeB, timeI, timeU, urlsFound, myView, bWait, uWait, lastFUEl,
	nv,
	skipTags 	= new RegExp("^(?:SCRIPT|FORM|INPUT|TEXTAREA|IFRAME|VIDEO|AUDIO|STYLE|META|NOSCRIPT)$"),
	SCHEME		= "([a-z\\d.-]+)://",
	HOSTNAME	= "(?:(?:[^\\s!@#$%^&*()_=+[\\]{}\\\\|;:'\",.<>/?]+)\\.)+",
	TLD			= "[a-z]{2,6}",
	HOST		= "(?:" + HOSTNAME + TLD + ")",
	PATH		= "(?:[;/][^#?<>\\s]*)?",
	QUERY_FRAG	= "(?:\\?[^#<>\\s]*)?(?:#[^<>\\s]*)?",
	URI1		= "\\b" + SCHEME + "[^<>\\s]+",
	URI2		= "\\b" + HOST + PATH + QUERY_FRAG + "(?!\\w)",
	URI_RE		= new RegExp( "(?:" + URI1 + "|" + URI2 + ")", "ig" ),
	KEY_RE,
	
	waitAni 	= `
	<span class="spinner">
	  <div class="bounce1"></div>
	  <div class="bounce2"></div>
	  <div class="bounce3"></div>
	</span>
`,
	myLayout	= `
	<div id="bs-pane" class="min">
	<a id="bsmin" href="javascript:">_</a>
	<a id="bsmax" href="javascript:"></a>
	<a id="bsclose" href="javascript:">X</a>
	<h2>
		<a href="javascript:" id="bs-icon">&nbsp;</a>Bookmarks search 
		<span id="bsbfound" class="info" title="Keyword search">${waitAni} <span id="bsbmsg"></span></span> 
		<span id="bsufound" class="info" title="Search engine results match">${waitAni} <span id="bsumsg"></span></span>
		<span id="bstime" class="info" title="Timing results&#10;  Keywords search&#10;  URL Indexing &#10; URL Search engine results match"></span> 
	</h2>
	<div id="bsmsg" class="info" hidden></div>
	<div id="bsbelow" hidden></div>
	</div>
`

//Connect with background script and redirect
let portBG 	= browser.runtime.connect()

portBG.onMessage.addListener( (m) => {								//console.log("Messsage from BG received:",m)

	//this or eval(m.fn) instead of window[m.fn], last searches on page, not content script funtions)
	let fn = this[m.fn]
	
	if (typeof fn === "function") fn(m)
	else console.error(m.fn + " is not a function", m, typeof fn)
	
	//Do Next search. we put it here so that in case of error before, it might continue 
	if (m.searchType == 1)
		searchUrls()	

})

/****** VIEW PANE (including minimize and restore) + activating bookmark sidebar****
************************************************************************************/

var keyhigh
function setOpts(a) {												//console.log("setOpts", a, keyhigh)
	keyhigh = a.keyhigh
	getSearchBox()
}
viewAdd(); //<-Without this semicolon we ge error...Bug?

//Grab some elements
["bsbfound",	"bsufound",	"bsmsg",	"bsbmsg",	"bsumsg",	"bstime",	"bsbelow",	"bsmin",	"bsmax",	"bsclose"]
	.forEach(s=>{
		this[s]=document.getElementById(s)
})
//Minimize, close etc..
bWait	= bsbfound	.firstElementChild
uWait	= bsufound	.firstElementChild
bsmin		.addEventListener('click', (e)=> {myView.classList.add("min")}, false)
bsmax		.addEventListener('click', (e)=> {myView.classList.remove("min")}, false)
bsclose		.addEventListener('click', viewRemove, false)
bsbelow		.addEventListener('click', (e)=> {lastFUEl.scrollIntoView()}, false)
bsufound	.addEventListener('click', (e)=> {
	document.body.classList.add("boom")
	setTimeout(() => {
		document.body.classList.remove("boom")
	}, 500);
	}, false)

function viewAdd()  {													//console.log("viewAdd", myView)
	if (!myView) {
		document.body.insertAdjacentHTML("beforeend", myLayout)
		myView	=	document.body.lastElementChild
	} else {
		document.body.appendChild(myView)
	}
	portBG.postMessage({fn: "CSAfterEnabled"})
}
function viewRemove(e=null)  {											//console.log("Disabling content script", e, myView, myView.parentNode)
    if (searchDelay) {
    	clearTimeout(searchDelay)
    }
	myView.remove()										
	portBG.postMessage({fn: "CSAfterDisabled", fromView:Boolean(e.target)})	
}
function msg(t,cls) {

	if(cls)
		bsmsg.classList.add(cls)
	bsmsg.show()
	bsmsg.textContent	= t	
	//Show viewpane or we can't read
	myView.classList.remove("min")
}

/**** Grabbing SE searchbox and general searching logic ****
************************************************************/

function getSearchBox() {
	if (searchBox	= document.getElementById("lst-ib") || document.querySelector("input[type=text]:enabled") || document.querySelector("input[type=search]:enabled")) {
		listenToSearchBox()
	} else {
		msg("Could not grab searchbox", "warning")
	}
}

function listenToSearchBox() {											//console.log("listenToSearchBox",searchBox)
	
	//if already filled in
	searchBasic()
	
	//listen for input changes
	searchBox.addEventListener('input', searchAfterType, false)			//propertychange change
	searchBox.addEventListener('paste', searchAfterType, false)
}

function searchAfterType(e=null) {
	delaySearch(450)
}
function delaySearch(s) {												//console.log("delaying Search, ms: ",s)
	clearTimeout(searchDelay)
	searchDelay = setTimeout(searchBasic, s)
}

function searchError(a) {
	msg(`Bookmark search error:<br>${a.e}`)
	if (a.searchType == 1) 
		inProgress = false
	else
		//Keep URL chain going
		searchUrl()
}

function execReplace(t) {
	let found = false
	let re = t.replace(KEY_RE, function(){						//console.log(arguments)
		found = true
		args = Array.from(arguments)
		match = args.shift()
		i = args.indexOf(match)
		return `<mark class="m${i}">${match}</mark>`
		})
	return found?re:false
}


/***** SEARCH FOR KEYWORDS  ****************
********************************************/
function searchBasic(o=null) {								//console.log("searchBasic  /  para ->",o,bsbfound)


	timeB = performance.now()
    searchTerm=searchBox.value.trim()

	//Inverse desire, but since we don't know a way to interrupt the search, we have to wait for it, otherwise overload!
	if (inProgress) { 										//console.log("Search in progress. Delaying. inProgress: ", inProgress)
		//reset timer
		delaySearch(500)
		return
	}

	//if delayed, clear timer & do delayed search
    if (searchDelay) {										//console.log("is delayed search")
    	clearTimeout(searchDelay)
        searchDelay = false
    }    
    
	if ((searchTerm.length < 2) || (searchTerm == lastSearch)) {		//console.log("No search because ", (searchTerm.length < 2)?"searchterm's length < 2,":"same as lastsearch,", "searchTerm:", searchTerm,"lastSearch:",lastSearch)
		//If refresh of page load with searchbox filled in, the page javascript magic often loads the searchbox later.
		if (justLoaded) {									//console.log("justLoaded, trying once more")
			justLoaded	= false
			delaySearch(1500)
		}
		return
	}
	
	//*********** Start search************
    
    //Prepare regex for marking keywords
	if (keyhigh) {
		KEY_RE	= new RegExp( "(" + searchTerm.replace(/\s+/g, ')|(') + ")", "ig" )
	}
	
	lastSearch = searchTerm
	//If endless loop, stop it! At same time set inProgress true (but only if loopSafeNet works!
	inProgress = setTimeout(()=>{inProgress=false}, 10000)
	bsbfound.classList.remove("warning", "success")
	bsufound.classList.remove("warning", "success")
	//Waiting animated icon
	bWait.classList.add("active")
	//Show bigger pane
	myView.classList.remove("min")
	portBG.postMessage({fn: "searchBasic", keywords:searchTerm, searchType:1})	
}

function showBasicResults(a) {											//console.log("showBasicResults ->",a)		
	
	inProgress 	= false	
	//Waiting animated icon
	bWait.classList.remove("active")
	let num		= a.bms.length,
		bsresults	= html2El('<div id="bsresults"></div>')	
	timeB = performance.now() - timeB
	bstime.textContent = `${timeB.toFixed()} ms`
		
	if (num > 0) {
		//Search was spit?
		if (a.split)
			msg("Found no bookmarks with all keywords. Showing results with one less keyword combinations.", 'lessterms')
		bsbfound.classList.add("success")
		
		//Create bookmark html
		a.bms.forEach(bm => {
			if (!(bm && bm.type=="bookmark")) return true
			let title	= bm.title.trim().length<1?"____No Title____":bm.title
			//Mark keywords
			if (keyhigh) {		
				if (temp = execReplace(title)) {				
					title = temp
				}
				texturl = (temp=execReplace(bm.url))?temp:bm.url
			} else {
				texturl = bm.url
			}		
			bsresults.appendChild(html2El(`<div><h3><a href="${bm.url}">${title}</a></h3><div><cite>${texturl}</cite></div></div>`))
		})	
		myView.insertBefore(bsresults, bsbelow)
		
	} else {
		bsbfound.classList.add("warning")
		msg("No bookmarks with same keywords.")
	}
	bsbmsg.textContent	= "Found: " + num

}

/***** SEARCH FOR MATCHING PAGE URLS  *************
***************************************************/

function searchUrls() {													//console.log("searchUrls Start")
	
	urlsFound	= 0
	timeI = performance.now()
	//Waiting animated icon
	uWait.classList.add("active")
	urls	= []
	findUrlsInPage(document.body)
	timeI = performance.now() - timeI
	timeU = performance.now()
	if(urls.length) 
		searchUrl(true)
}

function findUrlsInPage(node) {												//console.log("findUrlsInPage, loop:",findUrlsInPage.i++, "node:",node)
	
	//only nodes || not in our own viewport || not irrelevant tags
	if (!node || (node === myView) || skipTags.test(node.nodeName) || (node.nodeType === 8) )
		return;

	if	(
			( (node.nodeType === 3) && (nv = node.textContent.trim()) ) ||
			( (node.nodeType === 1) && node.hasAttribute("href") && (nv=node.href) )
		) {
		
		
		//URL search
		if ( regs = URI_RE.exec(nv) ) {										//console.log("found url regex", regs)
			//store parent nodes for textnodes (for highliting later etc.)
			let nodeHi = node.nodeType === 3?node.parentNode:node
				//If no scheme add scheme and www search, because webextension bookmark needs url! :-(
			if(regs[1] === undefined ) {									//console.log("found url regex without scheme", regs)
				urls.push({node:nodeHi, text:"http://"+regs[0]})
				urls.push({node:nodeHi, text:"http://www."+regs[0]})
				urls.push({node:nodeHi, text:"https://"+regs[0]})
				urls.push({node:nodeHi, text:"https://www."+regs[0]})
			} else {
				urls.push({node:nodeHi, text:regs[0]})
				//if http also search https and vice versa since url bm search is exact! :(
				if (regs[1]=="https")
					urls.push({node:nodeHi, text:regs[0].replace("https","http")})
				else if(regs[1]=="https")
					urls.push({node:nodeHi, text:regs[0].replace("http","https")})
			}
				
		}

		//Mark keywords
		if ( (node.nodeType === 3) && keyhigh && (temp = execReplace(nv))) {			//console.log("--found keyword in page->",nv, "<-", node.parentNode, "->>",temp,"<<-")

			let marked = html2El("<span> " + temp + " </span>")							//;console.log("----marked node",marked)
			node.parentNode.replaceChild(marked, node)
		}
		
	} 
	
	// traversing through DOM
	if ((node.nodeType === 1) && node.hasChildNodes()) 
		for (let child of node.childNodes)
			findUrlsInPage(child)	

}

function searchUrl(start=false) {
	if (start) {
		searchUrl.i = 0
	}
	else
		searchUrl.i++
																//console.log("searchUrl",searchUrl.i, urls)
	//At end
	if (searchUrl.i>=urls.length){
		//Waiting animated icon
		uWait.classList.remove("active")
		timeU = performance.now() - timeU
		if (!urlsFound)
			bsufound.classList.add("warning")
		bsumsg.textContent	= `Found: ${urlsFound}`
		bstime.textContent	+= `    -    ${timeI.toFixed()} ms - ${timeU.toFixed()} ms`
		return
	}																	//console.log("request next url search", searchUrl.i, urls.length, urls[searchUrl.i])
	portBG.postMessage({fn:"searchUrlBm", urls:urls[searchUrl.i].text, searchType:2})
}
function showUrlResult(a) {											//console.log("showUrlResult", a, searchUrl.i, myView)

	if (a.bms.length > 0) {
		urlsFound++
		lastFUEl	= urls[searchUrl.i].node
		lastFUEl.classList.add("urlInPage")
		//Check if need to be scrolled to view
		let coords = lastFUEl.getBoundingClientRect()
		let windowHeight = document.documentElement.clientHeight
		//bottom visible?
		if ( !(coords.bottom < windowHeight && coords.bottom > 0) )
			bsbelow.show()
		bsufound.classList.add("success")
	}
	if(myView) searchUrl()
}

/********GENERAL********
************************/
Element.prototype.show = function() {
	this.hidden = false
}
function html2El(html) {
    var template = document.createElement('template')
    html = html.trim() // Never return a text node of whitespace as the result
    template.innerHTML = html
    return template.content.firstChild
}
//So we don't get an error in bg script on executeScript. Some kind of bug?
true