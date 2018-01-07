let	searchBox	= false,	
	lastSearch	= false,
	inProgress	= false,
	searchDelay	= false,
	justLoaded	= true,
	searchTerm	= false,
	htmlResult	= "",
	urls, timeB, timeI, timeU, urlsFound
	
let waitAni 	= `
	<span class="spinner">
	  <div class="bounce1"></div>
	  <div class="bounce2"></div>
	  <div class="bounce3"></div>
	</span>
`
let myLayout	= `
	<div id="bs-pane">
	<a id="bs-min" href="javascript:">_</a>
	<a id="bs-max" href="javascript:"></a>
	<a id="bs-close" href="javascript:">X</a>
	<h2>
		<a href="javascript:" id="bs-icon">&nbsp;</a>Bookmarks search 
		<span id="bsbfound" class="info" title="Keyword search">${waitAni} <span id="bsbmsg"></span></span> 
		<span id="bsufound" class="info" title="Search engine results match search">${waitAni} <span id="bsumsg"></span></span>
		<span id="bstime" class="info" title="Timing results (Keyword search&#10;&#10;Search engine results&#10;Indexing - Search engine results match"></span> 
	</h2>
	<div id="bsmsg" class="info" style="display:none"></div>
	<div id="bsresults"></div>
	</div>
`

//Connect with background script and redirect
let portBG 		= browser.runtime.connect({name:"port-from-cs"})

portBG.onMessage.addListener( (m)=> {				//console.log("Messsage from BG received:",m)

	//this or eval(m.fn) instead of window[m.fn], last searches on page, not content script funtions)
	let fn = this[m.fn]
	if (typeof fn === "function") fn(m.pms)
	else console.error(m.fn + " is not a function", m, typeof fn)	
	
	//Do Next search
	if (m.searchType == 1)
		searchUrls()	

})

/************************************* OPTIONS ************************************
************************************************************************************/
var opts = {}		//must declare if no options yet keyhigh: true
browser.storage.local.get("keyhigh")
	.then(
		result => {
			opts = result
			getSearchBox()
		}, 
		error => {
			msg(`Error while getting your options: ${error}`, "warning")
			console.error(`Error while getting your options: ${error}`)
		}
	)
/****** VIEW PANE (including minimize and restore) + activating bookmark sidebar****
************************************************************************************/

let myView	= document.getElementById("bs-pane")
if (!myView) {
	document.body.insertAdjacentHTML("beforeend", myLayout)
	myView	=	document.body.lastElementChild
}

let bWait, uWait
//Grab some elements
[	"bsbfound",
	"bsufound",
	"bsmsg",
	"bsbmsg",
	"bsumsg",
	"bstime",
	"bsresults"
].forEach(s=>{
	this[s]=document.getElementById(s)
})
//Minimize, close etc..
bWait	= bsbfound	.firstElementChild
uWait	= bsufound	.firstElementChild
document.getElementById("bs-min")	.addEventListener('click', (e)=> {myView.classList.add("hidden")}, false)
document.getElementById("bs-max")	.addEventListener('click', (e)=> {myView.classList.remove("hidden")}, false)
document.getElementById("bs-close")	.addEventListener('click', disable, false)


function disable(e)  {											//console.log("Disabling content script")
    if (searchDelay) {
    	clearTimeout(searchDelay)
        searchDelay = null
    }
    //Listeners will be removed if all references are gone
    searchBox=null
    myView.parentNode.removeChild(myView)
	myView.remove()
    myView=null
    myHilitor = null
}

function msg(t,cls) {

	if(cls)
		bsmsg.classList.add(cls)
	bsmsg.style.display = "block"
	bsmsg.textContent	= t	
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
	delaySearch(350)
}
function delaySearch(s) {												//console.log("delaying Search, ms: ",s)
	clearTimeout(searchDelay)
	searchDelay = setTimeout(searchBasic, s)
}

function searchError(error, type) {
	msg(`Bookmark search error:<br>${error}`)
	if (type == 1) 
		inProgress = false
	else
		//Keep URL chain going
		searchNextUrlBm()
}

function execReplace(t) {
	if (ws = KEY_RE.exec(t)) {
		let re = t
		ws.forEach((w,i) => {
			if (i==0)
				return
			re = re.replace(w, `<mark class="m${i}">$&</mark>`)
		})
		return re
	}
	return false
}


/***** SEARCH FOR KEYWORDS  ****************
********************************************/
function searchBasic(e=null) {								//console.log("searchBasic  /  event ->",e)


	timeB = performance.now()
    searchTerm=searchBox.value.trim()
    
    //Prepare regex for marking keywords
	if (opts.keyhigh) {

		KEY_RE	= new RegExp( "(" + searchTerm.replace(/\s+/g, ')|(') + ")", "ig" )
	}

	//Inverse desire, but since we don't know a way to interrupt the search, we have to wait for it, otherwise overload!
	if (inProgress) { 										//console.log("Search in progress, inProgress: ", inProgress)
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
		
	lastSearch = searchTerm
	//If endless loop, stop it! At same time set inProgress true (but only if loopSafeNet works!
	inProgress = setTimeout(()=>{inProgress=false}, 10000)
	bsbfound.classList.remove("warning", "success")
	bsufound.classList.remove("warning", "success")
	//Waiting animated icon
	bWait.classList.add("active")
	portBG.postMessage({fn: "searchBasic", pms:searchTerm, searchType:1})	
}

function showBasicResults(bms) {						//console.log("showBasicResults, bms:",bms)		
	
	inProgress 	= false	
	htmlResult	= ""
	//Waiting animated icon
	bWait.classList.remove("active")
	let num		= bms.length
	
	timeB = performance.now() - timeB
	bstime.textContent = `${timeB.toFixed()} ms`
		
	if (num > 0) {
		bsbfound.classList.add("success")
		bms.forEach(makeHtml)
		bsresults.replaceInner(htmlResult)
	} else {
		bsbfound.classList.add("warning")
		msg("Found no bookmarks with keywords. Showing old results.")
	}
	bsbmsg.textContent	= "Found: " + num

}
function makeHtml(bm) {														//console.log(bm.id,bm.title,bm.url )
	let title	= bm.title.trim().length<1?"____No Title____":bm.title
	//Mark keywords
	if (opts.keyhigh) {
		
		if (temp = execReplace(title)) {				
			title = temp
		}
		texturl = (temp=execReplace(bm.url))?temp:bm.url
	} else {
		texturl = bm.url
	}
	htmlResult	+=	`<div><h3><a href="${bm.url}">${title}</a></h3><div><cite>${texturl}</cite></div></div>`
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
		searchNextUrlBm(true)
}

let nv,
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
	KEY_RE

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
				//If no scheme add scheme and www search, because fucking ebextension bookmark needs url! :-(
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
		if ( (node.nodeType === 3) && opts.keyhigh && (temp = execReplace(nv))) {		//console.log("--found text",nv, node)

			let marked = document.createElement("span")
			marked.innerHTML = temp
			//node = node.parentNode.replaceChild(node, marked)
			node.parentNode.insertBefore(marked, node);
			node.parentNode.removeChild(node);
		}
		
	} 
	
	// traversing through DOM
	if ((node.nodeType === 1) && node.hasChildNodes()) 
		for (let child of node.childNodes)
			findUrlsInPage(child)	

}

function searchNextUrlBm(start=false) {								//console.log("searchNextUrlBm", searchNextUrlBm.i, urls.length, urls[searchNextUrlBm.i])
	if (start) {
		searchNextUrlBm.i = 0
	}
	else
		searchNextUrlBm.i++

	//At end
	if (searchNextUrlBm.i>=urls.length){
		//Waiting animated icon
		uWait.classList.remove("active")
		timeU = performance.now() - timeU
		if (!urlsFound)
			bsufound.classList.add("warning")
		bsumsg.textContent	= `Found: ${urlsFound}`
		bstime.textContent	+= `    -    ${timeI.toFixed()} ms - ${timeU.toFixed()} ms`
		return
	}																//console.log("request next url search", searchNextUrlBm.i, urls.length, urls[searchNextUrlBm.i])
	portBG.postMessage({fn:"searchUrlBm", pms:urls[searchNextUrlBm.i].text, searchType:2})
}
function showUrlResult(bms) {

	if (bms.length > 0) {
		urlsFound++
		urls[searchNextUrlBm.i].node.classList.add("urlInPage")
		bsufound.classList.add("success")
	}
	searchNextUrlBm()
}

/********GENERAL********
************************/

Element.prototype.replaceInner	= function (html) {
  while (this.firstChild) { this.removeChild(this.firstChild) }
  this.insertAdjacentHTML('afterbegin',html)
  return this
}