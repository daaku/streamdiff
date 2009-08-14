/**
* Store session cookie.
*/
StreamDiff.Cookie = {
  NAME: 'fb',

  save: function() {
    if (Mu.session()) {
      document.cookie = (
        StreamDiff.Cookie.NAME + '=' +
          Mu.encodeQS(Mu.session()) +
          '; expires=' + new Date(Mu.session().expires * 1000).toGMTString() +
          '; path=/'
      );
    } else {
      StreamDiff.Cookie.clear();
    }
  },

  load: function() {
    var
    prefix  = StreamDiff.Cookie.NAME,
    cookies = document.cookie.split(';'),
    cookie,
    session = null;

    for (var i=0, l=cookies.length; i<l; i++) {
      cookie = cookies[i];

      while (cookie.charAt(0) === ' ') {
        cookie = cookie.substring(1, cookie.length);
      }

      if (cookie.indexOf(prefix) === 0) {
        session = Mu.decodeQS(cookie.substring(prefix.length, cookie.length));
        session.expires = parseInt(session.expires, 10);

        // check if its expired
        if (new Date(session.expires * 1000) < new Date()) {
          StreamDiff.Cookie.clear();
          session = null;
        }
        break;
      }
    }

    return session;
  },

  clear: function() {
    // also reset to Mu state to match
    Mu._session = null;
    StreamDiff.UserInfo.render();
    //this seems too aggressive
    //StreamDiff.Storage.clear();
    //StreamDiff.Stream._read = {};
    document.cookie = (
      StreamDiff.Cookie.NAME + '=' +
        '; expires=' + new Date(0).toGMTString() +
        '; path=/'
    );
  }
};
