var portCS
var currentSearch

//webext new connection with content scripts
function connected(p) {										//console.log("Connection from CS received:",p)
  portCS = p
  portCS.onMessage.addListener( (m)=> {						//console.log("Message from CS received:",m)

	  if(m.searchType)
		  currentSearch = m.searchType
		  
		let fn = window[m.fn]
		if (typeof fn === "function") fn(m.pms)
		else console.error(m.fn + " is not a function", fn)
	})
}
browser.runtime.onConnect.addListener(connected)

//Search logic

function searchFinished(bookmarkItems) {					//console.log("Bookmarks search finished",bookmarkItems)
	
	portCS.postMessage({fn: currentSearch==1?"showBasicResults":"showUrlResult", pms:bookmarkItems, searchType:currentSearch})
}

function searchRejected(error) {
	
	console.error(`Bookmark search error: ${error}`)
	portCS.postMessage({fn: "searchError", pms:error, searchType:currentSearch})
}

function searchBasic(keywords) {							//console.log("Main script searching", keywords)
	
	browser.bookmarks.search(keywords)
		.then(searchFinished, searchRejected)

}
//must be starting with valid protocol e.g. http
function searchUrlBm(url) {									//console.log("searchUrlBm", url)
	
	//Use try not to break the url chain //DOESn't work tho, still breaks everything, use timer?
	try {
		browser.bookmarks.search({url:url})
			.then(searchFinished, searchRejected)
	} catch (e) {
		searchRejected(e)
	}
}