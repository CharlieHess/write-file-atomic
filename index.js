'use strict'
var fs = require('graceful-fs')
var chain = require('slide').chain
var MurmurHash3 = require('imurmurhash')
var extend = Object.assign || require('util')._extend

var invocations = 0
var getTmpname = function (filename) {
  return filename + '.' + MurmurHash3(__filename).hash(process.pid).hash(++invocations).result()
}

module.exports = function writeFile (filename, data, options, callback) {
  if (options instanceof Function) {
    callback = options
    options = null
  }
  if (!options) options = {}
  var tmpfile = getTmpname(filename)

  if (options.mode && options.chown) {
    return thenWriteFile()
  } else {
    // Either mode or chown is not explicitly set
    // Default behavior is to copy it from original file
    return fs.stat(filename, function (err, stats) {
      if (err || !stats) return thenWriteFile()

      options = extend({}, options)
      if (!options.mode) {
        options.mode = stats.mode
      }
      if (!options.chown && process.getuid) {
        options.chown = { uid: stats.uid, gid: stats.gid }
      }
      return thenWriteFile()
    })
  }

  function thenWriteFile () {
    chain([
      [fs, fs.writeFile, tmpfile, data, options.encoding || 'utf8'],
      options.mode && [fs, fs.chmod, tmpfile, options.mode],
      options.chown && [fs, fs.chown, tmpfile, options.chown.uid, options.chown.gid],
      [fs, fs.rename, tmpfile, filename]
    ], function (err) {
      err ? fs.unlink(tmpfile, function () { callback(err) })
        : callback()
    })
  }
}

module.exports.sync = function writeFileSync (filename, data, options) {
  if (!options) options = {}
  var tmpfile = getTmpname(filename)

  try {
    if (!options.mode || !options.chown) {
      // Either mode or chown is not explicitly set
      // Default behavior is to copy it from original file
      try {
        var stats = fs.statSync(filename)
        options = extend({}, options)
        if (!options.mode) {
          options.mode = stats.mode
        }
        if (!options.chown && process.getuid) {
          options.chown = { uid: stats.uid, gid: stats.gid }
        }
      } catch (ex) {
        // ignore stat errors
      }
    }

    fs.writeFileSync(tmpfile, data, options.encoding || 'utf8')
    if (options.chown) fs.chownSync(tmpfile, options.chown.uid, options.chown.gid)
    if (options.mode) fs.chmodSync(tmpfile, options.mode)
    fs.renameSync(tmpfile, filename)
  } catch (err) {
    try { fs.unlinkSync(tmpfile) } catch (e) {}
    throw err
  }
}
