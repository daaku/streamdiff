/**
 * The Stream view.
 */
var Stream = {
  // the current stream view options
  _options: null,
  defaultOptions: {
    filter_key: 'nf',
    source_id: null,
    offset: 0,
    limit: 8
  },

  // persistent (client side) preferences
  // are loaded in init
  _prefs: null,
  defaultPrefs: {
    show_read: true
  },

  // cache these results from all previous runs
  _profiles: {},
  // cache these results for last run
  _posts: {},
  // marked as read
  _read: {},

  /**
   * Initialize.
   */
  init: function() {
    if (this._initListeners) {
      return;
    }
    this._initListeners = true;

    // try to load a saved set of post_ids marked as read
    this._read = Cache.get('markAsRead') || {};

    // try to load a saved set of preferences
    this._prefs = Cache.get('prefs') || {};
    StreamDiff.copy(this._prefs, Stream.defaultPrefs);

    // register the unload handler
    this.registerUnload();

    // register event delegators
    Delegator.listen('#stream .post .action-comment', 'click', function() {
      Comments.show(this);
    });
    Delegator.listen('#stream .post-comment', 'submit', function(ev) {
      ev.preventDefault();
      Comments.submit(this);
    });
    Delegator.listen('#stream .post .action-like', 'click', function() {
      Stream.like(this);
    });
    Delegator.listen('#stream .post .video a', 'click', function(ev) {
      Stream.playVideo(this, ev);
    });
    Delegator.listen('#stream .post .music a', 'click', function(ev) {
      Stream.playMusic(this, ev);
    });
    Delegator.listen('#stream .mark-as-read', 'click', function(ev) {
      Stream.markAsRead();
    });
    Delegator.listen('#stream .show-read', 'click', function(ev) {
      Stream.showRead();
    });
    Delegator.listen('#stream .hide-read', 'click', function(ev) {
      Stream.hideRead();
    });
    Delegator.listen('#stream .show-older', 'click', function(ev) {
      Stream.showOlder();
    });

    // initialize the Comments logic
    Comments.init();
  },

  registerUnload: function() {
    var existing = window.unload;
    window.onunload = function() {
      if (existing) {
        existing();
      }
      Cache.put('markAsRead', Stream._read);
      Cache.put('prefs', Stream._prefs);
    };
  },

  /**
   * Handle a view request.
   */
  view: function(options) {
    // options
    options = options || Stream._options;
    StreamDiff.copy(options, Stream.defaultOptions);
    Stream._options = options;

    if (!FB.getSession()) {
      Intro.view();
      return;
    }

    // eager show userInfo
    UserInfo.render();

    // the stream view
    var stream = (
      'SELECT ' +
        'post_id,' +
        'created_time,' +
        'updated_time,' +
        'actor_id,' +
        'target_id,' +
        'message,' +
        'attachment,' +
        'comments,' +
        'likes ' +
      'FROM ' +
        'stream ' +
      'WHERE '
    );
    if (options.source_id) {
      stream += 'source_id="' + options.source_id + '"';
    } else {
      stream += 'filter_key="' + options.filter_key + '"';
    }
    stream += (
      ' ORDER BY updated_time DESC' +
      ' LIMIT ' + options.limit +
      ' OFFSET ' + options.offset
    );

    // check for cache view for the corrent conditions and render it, or show
    // a spinner
    var cached = Cache.get(Stream.cacheKey());
    if (cached) {
      StreamDiff.setMainView(cached);
    } else {
      Spinner.show();
    }

    // the profiles we will potentially need based on the stream view we will
    // be rendering
    var profiles = (
      'SELECT ' +
        'id,' +
        'type,' +
        'name,' +
        'pic,' +
        'pic_square,' +
        'url ' +
      'FROM ' +
        'profile ' +
      'WHERE ' +
        'id IN (SELECT actor_id FROM #stream) OR ' +
        'id IN (SELECT target_id FROM #stream) OR ' +
        'id IN (SELECT comments.comment_list.fromid FROM #stream) OR ' +
        'id IN (SELECT likes.friends FROM #stream) OR ' +
        'id IN (SELECT likes.sample FROM #stream) OR ' +
        'id=' + FB.getSession().uid
    );

    var queries = {
      stream   : stream,
      profiles : profiles
    };
    StreamDiff.fql(queries, function(response) {
      Stream.render(response, options);
    });
  },

  updateProfiles: function(profiles_list) {
    var profiles = Stream._profiles;

    // do a pass and index profiles by id
    for (i=0, l=profiles_list.length; i<l; i++) {
      var profile = profiles_list[i];
      if (!profile.pic_square) {
        profile.pic_square =
          'http://static.ak.fbcdn.net/pics/q_silhouette.gif';
      }
      profiles[profile.id + ''] = profile;
    }

    return profiles;
  },

  /**
   * Handle and render the stream response.
   */
  render: function(response, options) {
    // init must happen after we have a confirmed session
    Stream.init();

    var
      stream   = response.stream,
      profiles = Stream.updateProfiles(response.profiles),
      read     = Stream._read,
      posts    = {},
      i,
      l;

    // refresh the user info box
    UserInfo.render(profiles[FB.getSession().uid]);

    // render all the posts
    var streamItems = [];
    for (i=0, l=stream.length; i<l; i++) {
      var post = stream[i];
      if (!Stream._prefs.show_read &&
          post.post_id in read &&
          read[post.post_id] == post.updated_time) {
        continue;
      }
      posts[post.post_id] = post;
      streamItems.push(Stream.renderPost(post, options));
    }

    var
      source     = profiles[options.source_id],
      sourceHtml = '',
      message    = 'What\'s on your mind?',
      pageTitle;
    if (source) {
      sourceHtml = (
        '<div class="source-info">' +
          '<a target="_blank" ' +
            'href="http://www.facebook.com/profile.php?id=' +
            source.id + '">' +
            '<img src="' + source.pic + '">' +
            source.name +
          '</a>' +
        '</div>'
      );
      message   = 'Write something…';
      pageTitle = 'StreamDiff — ' + source.name;
    } else {
      pageTitle = 'StreamDiff';
    }
    document.title = pageTitle;

    // if we did not end up rendering any posts, then we render a slightly
    // different view
    var mainStream;
    if (streamItems.length === 0) {
      mainStream = Stream.renderCraving(posts, options);
    } else {
      var toReadOrNotToRead = Stream._prefs.show_read
        ? '<button class="hide-read">Hide read posts</button>'
        : '<button class="show-read">View read posts</button>';

      mainStream = (
        '<ul id="posts">' +
          streamItems.join('') +
        '</ul>' +

        '<div class="craving-content">' +
          '<button class="mark-as-read">Mark as Read</button>' +
          ' ' +
          toReadOrNotToRead +
          ' ' +
          '<button class="show-older">Dig into the archives</button>' +
        '</div>'
      );
    }

    // the full body
    var html = (
      '<div id="stream" class="bd">' +
        sourceHtml +
        Publisher.render(message) +
        Stream.renderFromTo(stream, options) +
        mainStream +
      '</div>'
    );

    // cache for 1 hour if we had posts to display
    // otherwise clear the existing cache entry (if any)
    var cacheKey = Stream.cacheKey(options);
    if (streamItems.length > 0) {
      Cache.put(cacheKey, html, 3600);
    } else {
      Cache.remove(cacheKey);
    }

    // make sure this isnt a response for a stale request. the user may have
    // clicked on something else by the time this response came in.
    if (JSON.stringify(Stream._options) ==
          JSON.stringify(options)) {
      Stream._posts = posts;
      StreamDiff.setMainView(html);
    }
  },

  /**
   * Render a stream post.
   */
  renderPost: function(post, options) {
    var
      S     = Stream,
      actor = S._profiles[post.actor_id];

    return (
      '<li class="post" ' +
        'id="post-' + post.post_id + '" ' +
        'data-post-id="' + post.post_id +'">' +

        '<a class="actor-pic" href="#/profile/' + actor.id + '">' +
          '<img src="' + actor.pic_square + '">' +
        '</a>' +

        '<div class="bd">' +
          S.renderMessage    (post, options) +
          S.renderAttachment (post, options) +
          S.renderMeta       (post, options) +
          S.renderLikes      (post, options) +
          S.renderComments   (post, options) +
        '</div>' +
        '<div style="clear: left;"></div>' +
      '</li>'
    );
  },

  /**
   * Render the main textual message message.
   */
  renderMessage: function(post, options) {
    var
      profiles = Stream._profiles,
      actor    = profiles[post.actor_id],
      target   = '';

    if (post.target_id && options.source_id != post.target_id) {
      target = (
        ' &#8227; <a class="actor" href="#/profile/' + post.target_id + '">' +
          profiles[post.target_id].name +
        '</a>'
      );
    }

    return (
      '<div class="message">' +
        '<a class="actor" href="#/profile/' + actor.id + '">' +
          actor.name +
        '</a>' +
        target +
        ' ' +
        StreamDiff.linkyText(post.message || '') +
      '</div>'
    );
  },

  /**
   * Render the attachment if any.
   */
  renderAttachment: function(post, options) {
    var attachment = post.attachment;
    if (!attachment) {
      return '';
    }

    var
      has_media = attachment.media && attachment.media.length > 0,
      html      = '<div class="attachment">';

    if (has_media) {
      var type = attachment.media[0].type || '';
      html += '<div class="media ' + type + '">';
      for (var i=0, l=attachment.media.length; i<l; i++) {
        var
          media = attachment.media[i],
          src   = media.src || (media.video && media.video.preview_img);
        html += (
          '<a href="' + media.href + '">' +
            '<img src="' + src + '">' +
            (media.type == 'video' ? '<span class="play"></span>' : '') +
          '</a>'
        );
      }
      html += '</div>';
    }

    if (attachment.name) {
      html += (
       '<a class="name"' +
         (attachment.href ? ' href="' + attachment.href + '"' : '') + '>' +
           attachment.name +
       '</a>'
      );
    }

    if (attachment.caption) {
      html += '<div class="caption">' + attachment.caption + '</div>';
    }

    if (attachment.description) {
      html += '<div class="description">' + attachment.description + '</div>';
    }

    if (has_media) {
      html += '<div style="clear: left;"></div>';
    }
    html += '</div>';
    return html;
  },

  /**
   * Render the app icon, created time and action links.
   */
  renderMeta: function(post, options) {
    var
      icon = '',
      html = '';

    if (post.attachment && post.attachment.icon) {
      icon = '<img class="icon" src="' + post.attachment.icon + '">';
    }

    if (post.comments && post.comments.can_post) {
      html += ' &middot; <a class="action-comment">Comment</a>';
    }

    if (post.likes && post.likes.can_like && !post.likes.user_likes) {
      html += ' &middot; <a class="action-like">Like</a>';
    }

    return (
      '<div class="meta">' +
        icon +
        '<span class="time">' +
          StreamDiff.prettyDate(post.created_time) +
        '</span>' +
        html +
      '</div>'
    );
  },

  /**
   * Render the likes summary.
   */
  renderLikes: function(post, options) {
    if (!post.likes.count) {
      return '';
    }

    var
      profiles = Stream._profiles,
      likers   = [],
      likes    = post.likes,
      count    = post.likes.count,
      html,
      last;

     // check for self
     if (likes.user_likes) {
       likers.push(
         '<a href="#/profile/' + FB.getSession().uid + '">You</a>'
       );
       count--;
     }

     // friends and sample
     function collect(set) {
       if (set && set.length > 0) {
         for (var i=0, l=set.length; i<l; i++) {
           var id = set[i];
           likers.push(
             '<a href="#/profile/' + id + '">' +
               (profiles[id].name || 'Facebook User') +
             '</a>'
           );
         }
         count -= l;
       }
     }
     collect(likes.friends);

     // include samples only if someone else is there, and we wont end up
     // with '1 others' or if the samples are all the likes in total
     if (likes && likes.sample &&
         ((likers.length > 0 && Math.abs(count - likes.sample.length) != 1) ||
         likes.count == likes.sample.length)) {
       collect(likes.sample);
     }

     // the others
     if (count > 0) {
       // others == people if no friends/sample were found
       var baseHtml =
         '<a href="' + likes.href + '">' + StreamDiff.prettyNumber(count);
       if (count == likes.count) {
         if (count == 1) {
           likers.push(baseHtml + ' person' + '</a>');
         } else {
           likers.push(baseHtml + ' people' + '</a>');
         }
       } else {
         likers.push(baseHtml + ' others' + '</a>');
       }
     }

     // commas and ands
     if (likers.length > 1) {
       last = likers.pop();
     }
     html = likers.join(', ');
     if (last) {
       html += ' and ' + last;
     }

     // tail
     if (likes.count == 1 && !likes.user_likes) {
       html += ' likes this.';
     } else {
       html += ' like this.';
     }

     return '<div class="sub">' + html + '</div>';
  },

  /**
   * Render the posts's comments and the comment form.
   */
  renderComments: function(post, options) {
    var
      profiles = Stream._profiles,
      html = '',
      i,
      l;

     if (post.comments.count > 0) {
       if (post.comments.count != post.comments.comment_list.length) {
         html += (
           '<div class="sub">' +
             '<a href="#/details/' + post.post_id + '">' +
               'View all ' +
               StreamDiff.prettyNumber(post.comments.count) +
               ' comments.' +
             '</a>' +
           '</div>'
         );
       }

       for (i=0, l=post.comments.comment_list.length; i<l; i++) {
         var comment = post.comments.comment_list[i];
         html += (
           '<div class="sub comment">' +
             '<a class="from-pic" href="#/profile/' + comment.fromid + '">' +
               '<img ' +
                 'src="' + (profiles[comment.fromid] || {}).pic_square + '">' +
             '</a>' +
             '<div class="bd">' +
               '<div class="hd">' +
                 '<a href="#/profile/' + comment.fromid + '">' +
                   ((profiles[comment.fromid] || {}).name || 'Facebook User') +
                 '</a>' +
                 StreamDiff.prettyDate(comment.time) +
               '</div>' +
               StreamDiff.linkyText(comment.text) +
             '</div>' +
             '<div style="clear: left;"></div>' +
           '</div>'
         );
       }
     }

     if (post.comments && post.comments.can_post) {
       var style = html === '' ? ' style="display: none;"' : '';

       html += (
         '<form class="sub post-comment"' + style + '>' +
           '<img src="' + profiles[FB.getSession().uid].pic_square + '">' +
           '<textarea name="text">Write a comment…</textarea>' +
           '<div class="buttons">' +
             '<input type="submit" class="button" value="Comment">' +
           '</div>' +
         '</form>'
       );
     }

     return html;
  },

  renderCraving: function(posts, options) {
    var source;
    if (options.source_id) {
      if (Stream._profiles[options.source_id]) {
        source = Stream._profiles[options.source_id].name + '\'s';
      } else {
        source = 'Facebook User\'s';
      }
    } else {
      source = 'Your';
    }

    return (
      '<div class="no-content">' +
        '<h2>' + source + ' stream has no unread posts</h2>' +
        '<button class="show-read">View read posts</button>' +
        ' ' +
        '<button class="show-older">Dig into the archives</button>' +
      '</div>'
    );
  },

  renderFromTo: function(stream, options) {
    var info = 'Viewing ';
    if (options.source_id) {
      // TODO i18n
      if (options.source_id == FB.getSession().uid) {
        info += 'your ';
      } else if (Stream._profiles[options.source_id]) {
        info += Stream._profiles[options.source_id].name + '\'s ';
      }
    }

    if (options.offset) {
      info += (
        options.offset +
        '-' +
        (options.offset + options.limit) +
        ' '
      );
    }
    info += 'most recent ';

    if (!Stream._prefs.show_read) {
      info += 'unread ';
    }
    info += 'posts ';

    if (stream.length > 0) {
      info += (
        '(' +
          'from ' +
          StreamDiff.prettyDate(stream[0].updated_time) +
          ' to ' +
          StreamDiff.prettyDate(stream[stream.length-1].updated_time) +
        ')'
      );
    }

    return (
      '<div class="from-to">' +
        info +
      '</div>'
    );
  },

  cacheKey: function(options) {
    options = options || Stream._options;
    return 'stream' + JSON.stringify(options);
  },

  like: function(el) {
    var post_id = Stream.findPostId(el);

    function response() {
      // clear the cache since we do an unintelligent UI update
      Cache.remove(Stream.cacheKey());
      var post = Stream._posts[post_id];
      post.likes.user_likes = true;
      if (post.likes.count) {
        post.likes.count++;
      } else {
        post.likes.count = 1;
      }
      Stream.refreshPost(post_id);
    }

    FB.api({ method: 'Stream.addLike', post_id: post_id }, response);
  },

  playVideo: function(el, event) {
    event.preventDefault();

    var
      post      = Stream.findPost(el),
      post_id   = post.getAttribute('data-post-id'),
      data      = Stream._posts[post_id],
      swf       = data.attachment.media[0].video.source_url,
      mediaDiv  = StreamDiff.DOM.getElementsByClassName(post, 'media')[0],
      options   = {
        allowfullscreen : 'true',
        quality         : 'high',
        wmode           : 'transparent'
      };

    // special casing for FB Video
    if (/video.ak.facebook.com/.test(swf)) {
      var
        display_url = data.attachment.media[0].video.display_url,
        id          = /video.php\?v=(.*)/.exec(display_url)[1];
      options.allowscriptaccess = 'always';
      swf = 'http://www.facebook.com/v/' + id;
    }

    FlashReplace.replace(mediaDiv, swf, Math.random(), 450, 300, null, options);
  },

  playMusic: function(el, event) {
    //fixme
    event.preventDefault();

    var
      post      = Stream.findPost(el),
      post_id   = post.getAttribute('data-post-id'),
      data      = Stream._posts[post_id],
      swf       = data.attachment.media[0].video.source_url,
      mediaDiv  = StreamDiff.DOM.getElementsByClassName(post, 'media')[0],
      options   = {
        allowfullscreen : 'true',
        quality         : 'high',
        wmode           : 'transparent'
      };

    // special casing for FB Video
    if (/video.ak.facebook.com/.test(swf)) {
      var
        display_url = data.attachment.media[0].video.display_url,
        id          = /video.php\?v=(.*)/.exec(display_url)[1];
      options.allowscriptaccess = 'always';
      swf = 'http://www.facebook.com/v/' + id;
    }

    FlashReplace.replace(mediaDiv, swf, Math.random(), 450, 300, null, options);
  },

  markAsRead: function() {
    var
      posts = Stream._posts,
      read  = Stream._read,
      post_id;

    // mark the current posts as read
    for (post_id in posts) {
      if (posts.hasOwnProperty(post_id)) {
        read[post_id] = posts[post_id].updated_time;
      }
    }

    // refresh the view
    Stream._prefs.show_read = false;
    Stream.refresh();
  },

  showRead: function() {
    Stream._prefs.show_read = true;
    Stream.refresh();
  },

  hideRead: function() {
    Stream._prefs.show_read = false;
    Stream.refresh();
  },

  refresh: function() {
    Stream.view();
    Spinner.show();
    window.scrollTo(0, 0);
  },

  go: function(options) {
    var fragment = '';
    if (options.source_id) {
      fragment += '/profile/' + options.source_id;
    } else {
      fragment += '/filter/' + options.filter_key;
    }

    if (options.offset > 0) {
      fragment += '/' + options.offset;
    }
    window.scrollTo(0, 0);
    Herstory.load(fragment);
  },

  showOlder: function() {
    var options = Stream._options;
    Stream.go(StreamDiff.copy({
      offset: options.offset + options.limit
    }, options));
  },

  findPost: function(el) {
    while (el && el.getAttribute) {
      var id = el.getAttribute('data-post-id');
      if (id) {
        return el;
      }
      el = el.parentNode;
    }
  },

  findPostId: function(el) {
    var post = Stream.findPost(el);
    if (post) {
      return post.getAttribute('data-post-id');
    }
  },

  refreshPost: function(id) {
    var postHtml = Stream.renderPost(
      Stream._posts[id],
      Stream._options
    );

    // renderPost returns a html fragment like "<li>...</li>"
    // we create a ul, insert this via innerHTML and move the firstChild to
    // the correct place
    var
      currentPost = document.getElementById('post-' + id),
      ul = document.createElement('ul');
    ul.innerHTML = postHtml;
    currentPost.parentNode.replaceChild(ul.firstChild, currentPost);
  }
};
