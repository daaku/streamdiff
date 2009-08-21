var StreamDiff = {
  /**
   * Start your engines.
   */
  init: function() {
    // add a iphone class to html
    if (navigator.userAgent.toLowerCase().indexOf('iphone') > -1) {
      StreamDiff.DOM.addClass(
        document.getElementsByTagName('html')[0],
        'iphone'
      );
    }

    // setTimeout works around a FF iframe cache issue
    window.setTimeout(function() { StreamDiff._init(); }, 0);
  },

  /**
   * Really, start your engines.
   */
  _init: function() {
    // in dev, we use mu/xd.html, for prod we do far/xd.html
    var xdUrl = window.location.hostname.indexOf('dev.') == 0
      ? 'mu/xd.html'
      : 'far/xd.html';
    Mu.init(
      '2522fa99e515c8a86ec5bbb879732d85', // api key
      xdUrl,                              // xd receiver
      CookieAuth.load()                   // initial session (if any)
    );

    Delegator.listen('#doc .logout', 'click', function() {
      Mu.logout(function() {
        CookieAuth.clear();
        Intro.view();
      });
    });

    Delegator.listen('.share-streamdiff', 'click', StreamDiff.shareSite);

    // finally, use the cookied status or try to get a fresh status from
    // login_status to initialize the application
    if (Mu.session()) {
      StreamDiff.statusReady();
    } else {
      Mu.status(function(session) {
        StreamDiff.statusReady();
      });
    }
  },

  /**
   * Share the Site using a Publish Popup.
   */
  shareSite: function() {
    var post = {
      message: 'Checkout StreamDiff!',
      attachment: {
        name: 'StreamDiff',
        caption: 'Just see what\'s new!',
        description: (
          'StreamDiff provides an alternate view of your News Feed. ' +
            'It provides a Mark as read feature to bury the old stuff. ' +
            'New Posts, Comments and Like\'s will show ' +
            'up at the top for immediate consumption!'
        ),
        href: 'http://streamdiff.com/',
        media: [
          {
            type: 'image',
            src: 'http://streamdiff.com/logo.png',
            href: 'http://streamdiff.com/'
          }
        ]
      },
      action_links: [ { text: 'StreamDiff', href: 'http://streamdiff.com/' } ]
    };
    Mu.publish(post);
  },

  /**
   * Final part of init, called when we have a FB Connect status.
   */
  statusReady: function() {
    // reuse the xd receiver for ths history iframe
    // this call needs to happen in statusReady because it will call hashChange
    // to handle the current fragment. this may need to load data, so we should
    // make sure we know the status - either from the cookie, or a login_status
    // request.
    Herstory.init(StreamDiff.hashChange, 'far/xd.html');
  },

  /**
   * Handles a fragment change.
   */
  hashChange: function(hash) {
    if (hash == '/') {
      StreamDiff.Stream.view({});
    } else if (hash.indexOf('/profile/') === 0) {
      var
        rest      = hash.substr(9).split('/', 2),
        source_id = rest[0],
        offset    = rest[1] || 0;
      StreamDiff.Stream.view({
        source_id: source_id,
        offset: parseInt(offset, 10)
      });
    } else if (hash.indexOf('/filter/') === 0) {
      var
        rest       = hash.substr(8).split('/', 2),
        filter_key = rest[0],
        offset     = rest[1] || 0;
      StreamDiff.Stream.view({
        filter_key: filter_key,
        offset: parseInt(offset, 10)
      });
    } else if (hash.indexOf('/details/') === 0) {
      var
        rest    = hash.substr(9).split('/', 2),
        post_id = rest[0],
        offset  = rest[1] || 0;
      StreamDiff.Detail.view(post_id, offset);
    } else {
      //console.log('no match for hash: ' + hash);
      Herstory.load('/');
    }
  },

  /**
   * Sets the full main view.
   */
  setMainView: function(html) {
    document.getElementById('bd-container').innerHTML = html;
    Spinner.hide();
  },

 /**
  * Pretty Date
  * http://ejohn.org/files/pretty.js
  * TODO i18n
  */
 prettyDate: function(ts) {
   var
     date = new Date(ts * 1000),
     diff = (((new Date()).getTime() - date.getTime()) / 1000),
     day_diff = Math.floor(diff / 86400);

   if (isNaN(day_diff) || day_diff < 0) {
     return;
   }

   return day_diff === 0 && (
     diff < 60 && "just now" ||
     diff < 120 && "1 minute ago" ||
     diff < 3600 && Math.floor( diff / 60 ) + " minutes ago" ||
     diff < 7200 && "1 hour ago" ||
     diff < 86400 && Math.floor( diff / 3600 ) + " hours ago") ||
     day_diff == 1 && "Yesterday" ||
     day_diff < 7 && day_diff + " days ago" ||
     day_diff < 31 && Math.ceil( day_diff / 7 ) + " weeks ago" ||
     Math.floor(day_diff/30) + " months ago";
  },

  /**
   * Convert URLs into anchor tags.
   * TODO security check
   */
  linkyText: function(text) {
    var exp = /(\b(https?|ftp|file):\/\/[\-A-Z0-9+&@#\/%?=~_|!:,.;]*[\-A-Z0-9+&@#\/%=~_|])/i;
    return text.replace(exp, '<a href="$1">$1</a>');
  },

  /**
   * Format numbers for rendering.
   *
   * TODO i18n
   */
  prettyNumber: function(num) {
    num = num.toString();
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(num)) {
      num = num.replace(rgx, '$1' + ',' + '$2');
    }
    return num;
  },

  /**
   * Wrapper to make single or multiquery FQL calls.
   */
  fql: function(q, cb) {
    var isMulti = typeof q != 'string';

    // general callback logic
    function c(response) {
      // TODO sad, restart on error
      if (response.error_code) {
        //alert(JSON.stringify(response));
        //console.log(JSON.stringify(response));
        // missing permissions, session is still good
        if (response.error_code != 612) {
          CookieAuth.clear();
        }
        Intro.view();
        return;
      } else if (Mu.session()) {
        // good time to store a cookie
        CookieAuth.save();
      }

      // convert from array to named results for easier access
      // TODO shouldn't multiquery do this natively?
      if (isMulti) {
        var results = {};
        for (var i=0, l=response.length; i<l; i++) {
          results[response[i].name] = response[i].fql_result_set;
        }
        response = results;
      }

      cb(response);
    }

    if (isMulti) {
      Mu.api({ method: 'Fql.multiquery', queries: JSON.stringify(q) }, c);
    } else {
      Mu.api({ method: 'Fql.query', query: q }, c);
    }
  },

  copy: function(target, source, overwrite) {
    for (var key in source) {
      if (overwrite || !(key in target)) {
        target[key] = source[key];
      }
    }
    return target;
  }
};
