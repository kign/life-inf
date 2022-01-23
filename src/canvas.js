const assert = require("assert");

function Canvas(elm, density) {
  this.ctx = elm.getContext("2d");
  this.W = elm.clientWidth;
  this.H = elm.clientHeight;
  elm.width = this.W * density;
  elm.height = this.H * density;
  this.scale = {x: elm.width/elm.clientWidth, y: elm.height/elm.clientHeight};
}

Canvas.prototype.fillRect = function(x, y, w, h) {
  this.ctx.fillRect(x*this.scale.x, y*this.scale.y, w*this.scale.x, h*this.scale.y);
}

Canvas.prototype.strokeRect = function(x, y, w, h) {
  this.ctx.strokeRect(x*this.scale.x, y*this.scale.y, w*this.scale.x, h*this.scale.y);
}

Canvas.prototype.update_vp = function () {
  assert(this.vp_temp.zoom);
  this.vewport = this.vp_temp;
  this.vp_temp = {};
}

Canvas.prototype.clear = function() {
  this.ctx.clearRect(0, 0, this.W * this.scale.x, this.H * this.scale.y);
}

Canvas.prototype.showText = function(text, x, y) {
  this.ctx.fillText(text, x * this.scale.x, y * this.scale.y);
}

module.exports = {
  Canvas: Canvas
};