"use strict";

let parse = require("./parser-sync.cjs");
let pack = require("./packer-sync.cjs");

exports.read = function (buffer, options) {
  return parse(buffer, options || {});
};

exports.write = function (png, options) {
  return pack(png, options);
};
