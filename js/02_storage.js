/**
* Client side cache.
*/
StreamDiff.Storage = {
  put: function(key, value, expires) {
    key   = Mu.session().uid + key;
    value = JSON.stringify({
      value   : value,
      expires : expires ? new Date().getTime() + (expires * 1000) : null
    });

    if (window.localStorage) {
      localStorage[key] = value;
    } else if (window.globalStorage) {
      globalStorage[window.location.host][key] = value;
    }
  },

  get: function(key) {
    key = Mu.session().uid + key;
    var value;
    if (window.localStorage) {
      value = window.localStorage[key];
    } else if (window.globalStorage) {
      value = window.globalStorage[window.location.host][key];
    }

    if (value) {
      try {
        value = JSON.parse(value.toString());
      } catch(e) {
        this.remove(key);
        return;
      }

      if (value.expires && new Date(value.expires) < new Date()) {
        this.remove(key);
        return;
      } else {
        return value.value;
      }
    }
  },

  remove: function(key) {
    key = Mu.session().uid + key;
    if (window.localStorage) {
      window.localStorage[key] = '';
    } else if (window.globalStorage) {
      window.globalStorage[window.location.host][key] = '';
    }
  },

  clear: function() {
    if (window.localStorage) {
      window.localStorage.clear();
    } else if (window.globalStorage) {
      window.globalStorage.clear();
    }
  }
};
