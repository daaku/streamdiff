/**
 * DOM support. I'm going to delay using a library for as long as I can.
 */
StreamDiff.DOM = {
  regexpCache: {},
  regexp: function(str) {
    if (!StreamDiff.DOM.regexpCache[str]) {
      StreamDiff.DOM.regexpCache[str] = new RegExp(str);
    }
    return StreamDiff.DOM.regexpCache[str];
  },

  _classRegexp: function(className) {
    return StreamDiff.DOM.regexp('(?:^|\\s+)' + className + '(?:\\s+|$)');
  },

  hasClass: function(el, className) {
    return StreamDiff.DOM._classRegexp(className).test(el.className);
  },

  removeClass: function(el, className) {
    if (StreamDiff.DOM.hasClass(el, className)) {
      el.className = el.className.replace(
        StreamDiff.DOM._classRegexp(className), '');

      // in case of repeated classNames
      StreamDiff.DOM.removeClass(el, className);
    }
  },

  addClass: function(el, className) {
    if (!StreamDiff.DOM.hasClass(el, className)) {
      el.className = el.className + ' ' + className;
    }
  },

  getElementsByClassName: function(root, className) {
    if (root.getElementsByClassName) {
      return root.getElementsByClassName(className);
    }

    var
      elements = root.all ? root.all : root.getElementsByTagName('*'),
      matches  = [],
      currentElement;

    for (var i=0, l=elements.length; i<l; i++) {
      currentElement = elements[i];
      if (StreamDiff.DOM.hasClass(currentElement, className)) {
        matches.push(currentElement);
      }
    }
    return matches;
  }
};
