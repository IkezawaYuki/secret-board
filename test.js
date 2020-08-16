'use strict';

const pug = require('pug');
const assert = require('assert');

const html = pug.renderFile("./views/posts.pug", {
  posts: [
    {
      id: 1,
      content: "<script>alert('test');</script>",
      postedBy: "guest1",
      trackingCookie: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ],
  user: 'guest1'
})

assert(html.includes("&lt;script&gt;alert('test');&lt;/script&gt;"));
console.log("テストが正常に終了しました。")
