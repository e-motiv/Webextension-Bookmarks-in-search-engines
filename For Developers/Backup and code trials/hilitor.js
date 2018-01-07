// Original JavaScript code by Chirp Internet: www.chirp.com.au
// Please acknowledge use of this code by including this header.
// 2/2013 jon: modified regex to display any match, not restricted to word boundaries.

// License at http://www.the-art-of-web.com/copyright.html

(function(window, factory) {

  if (typeof module === "object" && typeof module.exports === "object") {
    // Expose a factory as module.exports in loaders that implement the Node
    // module pattern (including browserify).
    // This accentuates the need for a real window in the environment
    // e.g. var jQuery = require("jquery")(window);
    module.exports = function(w) {
      w = w || window;
      if (!w.document) {
        throw new Error("Hilitor requires a window with a document");
      }
      return factory(w.document);
    };
  } else {
    if (typeof define === "function" && define.amd) {
      // AMD. Register as a named module.
      define([], function() {
        return factory(document);
      });
    } else {
      // Browser globals
      window.Hilitor = factory(document);
    }
  }

  // Pass this, window may not be defined yet
}(this, function(document, undefined) {


  function Hilitor(options) {
    options = options || {};


    var hiliteTag = options.tag || "EM";
    var hClass = options.hClass || "hilitor";
    var skipTags = new RegExp("^(?:SCRIPT|FORM|INPUT|TEXTAREA|IFRAME|VIDEO|AUDIO)$");
    var wordN = [];
    var colorIdx = 0;
    var matchRegex = "";
    var openLeft = true;
    var openRight = true;
    
    if (typeof options.onStart !== 'function') {
      options.onStart = function() { /* return FALSE when you want to abort */ };
    }
    if (typeof options.onFinish !== 'function') {
      options.onFinish = function() { /* What you return here is returned by Hilitor.apply() */
        return true;
      };
    }
    if (typeof options.onDoOne !== 'function') {
      options.onDoOne = function(node) { /* return FALSE when you want to skip the highlighting change for this node */ };
    }

    this.setMatchType = function(type) {
      switch (type) {
        case "left":
          openLeft = false;
          openRight = true;
          break;
        case "right":
          openLeft = true;
          openRight = false;
          break;
        default:
        case "open":
          openLeft = openRight = true;
          break;
        case "complete":
          openLeft = openRight = false;
          break;
      }
    };

    this.setRegex = function(input) {
      input = input.replace(/[ ]+/g, "|").replace(/\./g,"\\.");

      if(options.stripNumber){
        input = input.replace(/[^\w0-9\\u ]+/, "");
      }

      var re = "(" + input + ")";
      if (!openLeft) re = "\\b" + re;
      if (!openRight) re = re + "\\b";
      matchRegex = new RegExp(re, "i");
    };

    this.getRegex = function() {
      var retval = matchRegex.toString();
      retval = retval.replace(/^\/(\\b)?|(\\b)?\/i$/g, "");
      retval = retval.replace(/\|/g, " ");
      return retval;
    };

    // recursively apply word highlighting
    this.hiliteWords = function(node) {
      var i;

      if (!node)
        return;
      if (!matchRegex)
        return;
      if (skipTags.test(node.nodeName))
        return;
      if (node.nodeName === hiliteTag && node.classList.contains(hClass))
        return;

      if (node.hasChildNodes()) {
        for (i = 0; i < node.childNodes.length; i++) {
          this.hiliteWords(node.childNodes[i]);
        }
      }
      if (node.nodeType === 3) { // NODE_TEXT
        if ((nv = node.nodeValue) && (regs = matchRegex.exec(nv))) {
          if (false !== options.onDoOne.call(this, node)) {
             if(!wordN[regs[0].toLowerCase()]) {
            	 wordN[regs[0].toLowerCase()] = ++colorIdx % 12;
                }
            var match = document.createElement(hiliteTag);
            match.appendChild(document.createTextNode(regs[0]));
            match.className = hClass + " " + (wordN[regs[0].toLowerCase()]);

            var after = node.splitText(regs.index);
            after.nodeValue = after.nodeValue.substring(regs[0].length);
            node.parentNode.insertBefore(match, after);
          }
        }
      }
    };

    // remove highlighting
    this.remove = function() {
      var arr, i;
      do {
        arr = document.querySelectorAll(hiliteTag + "." + hClass);
        i = 0;
        while (i < arr.length && (el = arr[i])) {
          // store the reference to the parent of the hilite tag as that node itself, 
          // and all its links, is invalidated in the next .replaceChild() call:
          var parentNode = el.parentNode;
          if (!parentNode) {
            i++;
            // this entry would otherwise crash in the code below; we can however improve 
            // on the total run-time costs by cutting back on the number of times we trigger
            // the outer loop (which serves as a recovery mechanism anyway) by continuing
            // with this querySelectorAll()'s results, but at it's higher indexes, which
            // are very probably still valid/okay. This saves a number of outer loops and 
            // thus a number of querySelectorAll calls.
            continue;
          }
          // Note that this stuff can crash (due to the parentNode being nuked) when multiple
          // snippets in the same text node sibling series are merged. That's what the
          // parentNode check is for. Ugly. Even while the .querySelectorAll() 'array' is updated
          // automatically, which would imply that this never occurs, yet: it does. :-(
          parentNode.replaceChild(el.firstChild, el);
          // and merge the text snippets back together again.
          parentNode.normalize();
        }
      } while (arr.length > 0);
    };

    // start highlighting at target node
    this.apply = function(input, elements = [document.body]) {
      // always remove all highlight markers which have been done previously
      if (!input) {
        return false;
      }
      this.setRegex(input);

      this.remove();

      var rv = options.onStart.call(this);
      if (rv === false) {
        return rv;
      }

      for (var i = elements.length - 1; i >= 0; i--) {
        var targetNode = elements[i];
        targetNode.normalize();
        this.hiliteWords(targetNode);
      };

      // ensure all text node series are merged, etc. so that we don't have to bother with fragmented texts in the search/scan.
      return options.onFinish.call(this);
    };

    this.setMatchType(options.matchType);
  }


  return Hilitor;
}));