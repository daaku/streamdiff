/**
* Store session cookie.
*/
var CookieAuth = {
  NAME: 'fb',

  save: function() {
    if (Mu.session()) {
      document.cookie = (
        CookieAuth.NAME + '=' +
          Mu.QS.encode(Mu.session()) +
          '; expires=' + new Date(Mu.session().expires * 1000).toGMTString() +
          '; path=/'
      );
    } else {
      CookieAuth.clear();
    }
  },

  load: function() {
    var
    prefix  = CookieAuth.NAME,
    cookies = document.cookie.split(';'),
    cookie,
    session = null;

    for (var i=0, l=cookies.length; i<l; i++) {
      cookie = cookies[i];

      while (cookie.charAt(0) === ' ') {
        cookie = cookie.substring(1, cookie.length);
      }

      if (cookie.indexOf(prefix) === 0) {
        session = Mu.QS.decode(cookie.substring(prefix.length, cookie.length));
        session.expires = parseInt(session.expires, 10);

        // check if its expired
        if (new Date(session.expires * 1000) < new Date()) {
          CookieAuth.clear();
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
    UserInfo.render();
    //this seems too aggressive
    //Cache.clear();
    //Stream._read = {};
    document.cookie = (
      CookieAuth.NAME + '=' +
        '; expires=' + new Date(0).toGMTString() +
        '; path=/'
    );
  }
};
