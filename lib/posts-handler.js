'use strict';
const pug = require('pug');
const crypto = require('crypto');
const Cookie = require('cookies');
const util = require('./handler-util');
const Post = require('./post');
const moment = require('moment-timezone');
const { match } = require('assert');

const trackingIdKey = "tracking_id";

const oneTimeTokenMap = new Map();

function handle(req, res){
  const cookies = new Cookie(req, res);
  const trackingId = addTrackingCookie(cookies, req.user);
  switch (req.method){
    case 'GET':
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      Post.findAll({order: [['id', 'DESC']]}).then((posts) => {
        posts.forEach(post => {
          post.content = post.content.replace(/\+/g, " ")
          post.formattedCreatedAt = moment(post.createdAt).tz('Asia/Tokyo').format('YYYY年MM月DD日 HH時mm分ss秒');
        });
        const oneTimeToken = crypto.randomBytes(8).toString('hex');
        oneTimeTokenMap.set(req.user, oneTimeToken);
        res.end(pug.renderFile('./views/posts.pug', {
          posts: posts,
          user: req.user,
          oneTimeToken: oneTimeToken
        }));
        console.info(`閲覧されました: user: ${req.user}, ` +
        `trackingId: ${trackingId}, ` +
        `remoteAddress: ${req.connection.remoteAddress}, ` +
        `userAgent: ${req.headers['user-agent']}`)
      });
      break;
    case 'POST':
      let body = [];
      req.on("data", (chunk) => {
        body.push(chunk);
      }).on("end", () => {
        body = Buffer.concat(body).toString();
        const decoded = decodeURIComponent(body);
        
        const matchResult = decoded.match(/content=(.*)&oneTimeToken=(.*)/)
        if (!matchResult){
          util.handleBadRequest(req, res);
        }else{
          const content = matchResult[1];
          const requestedOneTimeToken = matchResult[2];
          if(oneTimeTokenMap.get(req.user) === requestedOneTimeToken){
            console.info("投稿されました: " + content)
            Post.create({
              content: content,
              trackingCookie: trackingId,
              postedBy: req.user,
            }).then(() => {
              oneTimeTokenMap.delete(req.user);
              handleRedirectPosts(req, res);
            });
          } else {
            util.handleBadRequest(req, res);
          }
        }
      })
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

function handleDelete(req, res){
  switch(req.method){
    case 'POST':
      let body = [];
      req.on("data", (chunk) => {
        body.push(chunk);
      })
      .on("end", () => {
        body = Buffer.concat(body).toString();
        const decoded = decodeURIComponent(body);
        const matchResult = decoded.match(/id=(.*)&oneTimeToken=(.*)/)
        if (!matchResult){
          util.handleBadRequest(req, res);
        } else{
          const id = matchResult[1];
          const requestedOneTimeToken = matchResult[2];
          if (oneTimeTokenMap.get(req.user) === requestedOneTimeToken){
            Post.findByPk(id).then((post) => {
              if (req.user === post.postedBy || req.user === "admin"){
                post.destroy().then(() => {
                  console.info(
                    `削除されました: user: ${req.user}, ` +
                    `remoteAddress: ${req.connection.remoteAddress}, ` +
                    `userAgent: ${req.headers['user-agent']} `
                  );
                  oneTimeTokenMap.delete(req.user);
                  handleRedirectPosts(req, res);
                });
            } else{
              util.handleBadRequest(req, res);
            }
          });
        }
      }
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

/**
 * Cookieに含まれているトラッキングIDに異常がなければその値を返し、
 * 存在しない場合や異常なものである場合には、再度作成しCookieに付与してその値を返す
 * @param {Cookies} cookies 
 * @param {String} userName
 * @param {String} トラッキングID 
 */
function addTrackingCookie(cookies, userName){
  const requestedTrackingId = cookies.get(trackingIdKey);
  if (isValidTrackingId(requestedTrackingId, userName)){
    return requestedTrackingId;
  } else{
    const originalId = parseInt(crypto.randomBytes(8).toString('hex'), 16);
    const tomorrow = new Date(Date.now() + (1000 * 60 * 60 * 24));
    const trackingId = originalId + '_' + createValidHash(originalId, userName);
    cookies.set(trackingIdKey, trackingId, { exprires: tomorrow });
    return trackingId;
  }
}

function isValidTrackingId(trackingId, userName){
  if (!trackingId){
    return false;
  }
  const splitted = trackingId.split('_');
  const originalId = splitted[0];
  const requestedHash = splitted[1];
  return createValidHash(originalId, userName) === requestedHash;
}

const secretKey = '619d3bba8cac3f5ef3602240b52b18de5e5465bc1ec' +
'e7401bf60f3dd5cf970070f8e39821ef6fd4ce38b63fe727d9b26bf0de262' + 
'686453669f1682b259e4e59aeec7c2dab44740f3dbedfcc004f95a6f91e3a' + 
'e995fe36a12c3e52289a95459979db2d4c4f72ea9434e0106e0f08b595468' +
'f5b1bf751a25ffde99f7a60e3028a5362a92aea946e3afba0d38dc72715f9' + 
'6b4315c48fe25758aed1979e88b809063e9872acf3d25fb081d2218231d7e' +
'269475df2fb98e0b9ac566be17718b3059cf9ca261921d35284b30aa8fd18' +
'ad081cafde3f7261d2eeaff1787aee8e57d962941ab656a31f9815a6ff9ac' + 
'9e6660d87c676917a30e7e852eca6dafe5478aede4'

function createValidHash(originalId, userName){
  const sha1sum = crypto.createHash("sha1");
  sha1sum.update(originalId + userName + secretKey);
  return sha1sum.digest("hex");
}

function handleRedirectPosts(req, res){
  res.writeHead(303, {
    'Location': '/posts'
  });
  res.end();
}


module.exports = {
  handle, handleDelete
};