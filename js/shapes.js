/**
 * Created by Itai Caspi on 28/07/2016.
 */

/*
 *  Shape Factory
 */
function object_to_shape(obj) {
    return new window[obj.type](obj);
}


/*
 * Inheritance helper function
 */
var inheritsFrom = function (child, parent) {
    child.prototype = Object.create(parent.prototype);
    child.prototype.constructor = child;
};

/*
 * Line
 */
var Line = function(vertices, radius, color, stroke, key) {
    if (stroke == undefined) {
        // copy constructor
        var shape = vertices;
        var linkStart = radius;
        var linkEnd = color;
        assign(this, shape);
        this.vertices = [];
        for (var i = 0; i < shape.vertices.length; i++) {
            this.vertices.push(new Vertex(shape.vertices[i]));
        }
        this.linkStart.shape = linkStart;
        this.linkEnd.shape = linkEnd;
        this.default_color = new Color(shape.color);
        this.color = new Color(shape.color);
        this.border_color = new Color(shape.color);

        this.key = shape.key;
    } else {
        this.vertices = vertices;
        this.default_color = color;
        this.color = color;
        this.border_color = color;
        this.stroke = (typeof stroke != 'undefined') ? stroke : 1;
        this.radius = (typeof radius != 'undefined') ? radius : 2;
        this.points = 0;
        this.linkStart = {};
        this.linkEnd = {};
        this.startDir = [];
        this.endDir = [];
        this.broken_start = false;
        this.broken_end = false;
        this.draw_separating_border = true;
        this.type = "Line";

        this.key = new Uint32Array(1);
        window.crypto.getRandomValues(this.key);
        this.key = (typeof key != 'undefined') ? key : this.key[0];
    }
};


/*
 * Returns a new copy of the current line
 */
Line.prototype.clone = function() {
    return new Line(this, this.linkStart.shape, this.linkEnd.shape);
};

/*
 * Check if the line given by two points is part of the multi segment line
 */
Line.prototype.has_border_line = function(line_points) {
    var i;
    for (i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[(i + 1) % this.vertices.length];
        if (vi.key == line_points.p1.key && vj.key == line_points.p2.key) {
            return true;
        }
    }
    return false;
};

/*
 * Check if the line is connected to one of the given shapes and return the connected shapes
 */
Line.prototype.shapes_are_linked = function(shapes) {
	var is_start = false;
	var is_end = false;
	for (var i = 0; i < shapes.length; i++) {
	    if (Object.keys(this.linkStart).length > 0 && shapes[i].has_border_line(this.linkStart)) {
            is_start = shapes[i];
        }
        if (Object.keys(this.linkEnd).length > 0 && shapes[i].has_border_line(this.linkEnd)) {
            is_end = shapes[i];
        }
	}
	return [is_start, is_end]
};

/*
 * Update the line placement if one of the given shapes is connected to it
 */
Line.prototype.linked_shapes_moved = function(dx, dy, shapes) {
	var results = this.shapes_are_linked(shapes);
	var start_moved = results[0];
	var end_moved = results[1];

    if (start_moved && end_moved) {//} && start_moved.type != "Line" && end_moved.type != "Line") {
        this.translate(dx,dy);
    }
    if (start_moved) {
        this.linkStart.p1 = start_moved.get_vertex_by_key(this.linkStart.p1.key);
        this.linkStart.p2 = start_moved.get_vertex_by_key(this.linkStart.p2.key);
        this.sync_start();
    }

    if (end_moved) {
        this.linkEnd.p1 = end_moved.get_vertex_by_key(this.linkEnd.p1.key);
        this.linkEnd.p2 = end_moved.get_vertex_by_key(this.linkEnd.p2.key);
        this.sync_end();
    }

    this.sync_start();
    this.sync_end();
};


/*
 * Update the line color if the given shape is connected to the beginning of the line
 */
Line.prototype.linked_shape_color_change = function(shape, arrows) {
    if (shape.has_border_line(this.linkStart)) {
        this.color = shape.border_color;
        this.border_color = shape.border_color;
        this.default_color = shape.border_color;
        for (var a = 0; a < arrows.length; a++) {
            arrows[a].linked_shape_color_change(this, arrows);
        }
    }
};

/*
 * Initialize the line by connecting it to the given shape as a start point
 */
Line.prototype.start_line = function(start, color, linkStart) {
    // linkStart is an array of 2 points and a type
    this.points++;
    this.vertices[0] = start;
    this.color = color;
    this.border_color = color;
    this.linkStart = linkStart;
	this.startDir = direction_of_line_between_two_points(linkStart.p1, linkStart.p2, 0);
	this.sync_start();
};

/*
 * Add a new point to the line
 */
Line.prototype.add_point = function(point) {
    var lastIdx = this.points-1;
    if (this.points == 1) {
        if (this.startDir == "horizontal" || (this.startDir == "diagonal" && Math.abs(point.x - this.vertices[lastIdx].x) < Math.abs(point.y - this.vertices[lastIdx].y))) {
            this.vertices[this.points] = new Vertex(this.vertices[lastIdx].x, point.y, 0);
        } else {
            this.vertices[this.points] = new Vertex(point.x, this.vertices[lastIdx].y, 0);
        }
    } else if (this.points > 1) {
        if (this.vertices[lastIdx].y == this.vertices[lastIdx-1].y) {
            this.vertices[this.points] = new Vertex(this.vertices[lastIdx].x, point.y, 0);
        } else {
            this.vertices[this.points] = new Vertex(point.x, this.vertices[lastIdx].y, 0);
        }
    }
};

/*
 * Finalize the line by connecting it to the given shape
 */
Line.prototype.end_line = function(end, linkEnd) {
    var lastIdx = this.points-1;
    var error_allowed = 10;
    // close a line
    if (Math.abs(this.vertices[lastIdx].y - end.y) > error_allowed || Math.abs(this.vertices[lastIdx].x - end.x) > error_allowed) {
        if (this.vertices[lastIdx].y == this.vertices[lastIdx-1].y) {
            this.vertices[lastIdx+1] = new Vertex(this.vertices[lastIdx].x, end.y, 0);
        } else {
            this.vertices[lastIdx+1] = new Vertex(end.x, this.vertices[lastIdx].y, 0);
        }
    } else if (this.points > 2) {
        this.points--;
    } else {
        linkEnd.dist = relative_position_on_the_line_between_two_points(linkEnd.p1, linkEnd.p2, this.vertices[lastIdx]);
    }
    this.points = this.vertices.length;
    lastIdx = this.points-1;
    this.endDir = direction_of_line_between_two_points(this.vertices[lastIdx], this.vertices[lastIdx-1], 0);
    this.linkEnd = linkEnd;
    this.sync_end();
};

/*
 * Draw the line
 */
Line.prototype.draw = function(ctx) {
    if (this.vertices.length == 0) return;
    var horizontal, vertical, over, offset;
    ctx.beginPath();
    ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
    for (var v = 1; v < this.vertices.length; v++) {
        var last = (v == this.vertices.length - 1);
        horizontal = (this.vertices[v].y == this.vertices[v-1].y);
        vertical = (this.vertices[v].x == this.vertices[v-1].x);
        over = (horizontal && this.vertices[v].x >= this.vertices[v-1].x) || (vertical && this.vertices[v].y >= this.vertices[v-1].y);
        offset = (over ? -this.radius : this.radius);
        if (this.vertices[v].subtract(this.vertices[v-1]).norm() < this.radius) {
            offset*=0.1;
        }
        if (horizontal) {
            if (v > 1) ctx.quadraticCurveTo(this.vertices[v-1].x, this.vertices[v-1].y, this.vertices[v-1].x - offset, this.vertices[v-1].y);
            ctx.lineTo(this.vertices[v].x + (last ? offset : offset), this.vertices[v].y);
        } else if (vertical) {
            if (v > 1) ctx.quadraticCurveTo(this.vertices[v-1].x, this.vertices[v-1].y, this.vertices[v-1].x, this.vertices[v-1].y - offset);
            ctx.lineTo(this.vertices[v].x, this.vertices[v].y + (last ? offset : offset));
        }
    }

    // draw border
    if (this.stroke > 0) {
        // draw border to distinguish between intersecting lines
        // TODO: disable this when saving images
        if (this.draw_separating_border) {
            ctx.strokeStyle = "#EBECED";
            ctx.lineWidth = this.stroke + 6;
            ctx.stroke();
        }
        // draw line
        ctx.strokeStyle = this.border_color.to_string();
        ctx.lineWidth = this.stroke;
        ctx.stroke();
    }

    //TODO:
    // for (var v = 0; v < this.vertices.length; v++) {
    //     ctx.beginPath();
    //     ctx.arc(this.vertices[v].x, this.vertices[v].y, 5, 0, 2 * Math.PI, false);
    //     ctx.fillStyle = this.border_color.to_string();
    //     ctx.fill();
    // }

    // draw arrow head
    ctx.beginPath();
    ctx.moveTo(this.vertices[this.vertices.length-1].x, this.vertices[this.vertices.length-1].y);
    if (horizontal) {
        ctx.lineTo(this.vertices[this.vertices.length-1].x + offset * 2, this.vertices[this.vertices.length-1].y+5);
        ctx.lineTo(this.vertices[this.vertices.length-1].x + offset * 2, this.vertices[this.vertices.length-1].y-5);
    } else if (vertical) {
        ctx.lineTo(this.vertices[this.vertices.length-1].x+5, this.vertices[this.vertices.length-1].y + offset * 2);
        ctx.lineTo(this.vertices[this.vertices.length-1].x-5, this.vertices[this.vertices.length-1].y + offset * 2);
    }
    ctx.closePath();
    ctx.fillStyle = this.border_color.to_string();
    // if (this.draw_separating_border) {
    //     ctx.strokeStyle = "#EBECED";
    //     ctx.lineWidth = this.stroke + 4;
    //     ctx.stroke();
    // }
    ctx.fill();

    if (this.linkStart.shape.type == "Line") {
        ctx.beginPath();
        ctx.arc(this.vertices[0].x, this.vertices[0].y, 5, 0, 2 * Math.PI, false);
        ctx.fillStyle = this.border_color.to_string();
        ctx.fill();
    }
};


/*
 * Move the entire line
 */
Line.prototype.translate = function(dx,dy) {
    for (var v = 0; v < this.vertices.length; v++) {
        this.vertices[v].translate(dx,dy,0);
    }
};

Line.prototype.update_vertices = function(reverse) {
    var startDir;
    if (this.endDir == "vertical" && this.points % 2 == 1) startDir = "horizontal";
    else if (this.endDir == "vertical" && this.points % 2 == 0) startDir = "vertical";
    else if (this.endDir == "horizontal" && this.points % 2 == 1) startDir = "vertical";
    else if (this.endDir == "horizontal" && this.points % 2 == 0) startDir = "horizontal";

    if (reverse) {
        for (var v = 1; v < this.vertices.length; v++) {
            if ((startDir == "horizontal" && v % 2 == 0) || (startDir == "vertical" && v % 2 == 1)) {
                this.vertices[v-1].x = this.vertices[v].x;
            } else {
                this.vertices[v-1].y = this.vertices[v].y;
            }
        }
    } else {
        for (var v = 1; v < this.vertices.length; v++) {
            if ((startDir == "horizontal" && v % 2 == 0) || (startDir == "vertical" && v % 2 == 1)) {
                this.vertices[v].x = this.vertices[v-1].x;
            } else {
                this.vertices[v].y = this.vertices[v-1].y;
            }
        }
    }

    // remove groups of 3 vertices lying on the same line
    for (var v = this.vertices.length-1; v >= 2; v--) {
        if (this.broken_start && v <= 4) break;
        if (this.broken_end && v >= this.vertices.length-5) continue;
        if (this.vertices.length > 3) {
            if ((this.vertices[v-2].x == this.vertices[v-1].x && this.vertices[v-1].x == this.vertices[v].x) ||
                (this.vertices[v-2].y == this.vertices[v-1].y && this.vertices[v-1].y == this.vertices[v].y)) {
                this.vertices.splice(v-2,2);
            }
        }
    }

    this.points = this.vertices.length;
};

Line.prototype.move_start = function(dx, dy) {
    var startDir;
    if (this.endDir == "vertical" && this.points % 2 == 1) startDir = "horizontal";
    else if (this.endDir == "vertical" && this.points % 2 == 0) startDir = "vertical";
    else if (this.endDir == "horizontal" && this.points % 2 == 1) startDir = "vertical";
    else if (this.endDir == "horizontal" && this.points % 2 == 0) startDir = "horizontal";

    if (this.linkStart.p2 == undefined) return;
    var new_x = this.linkStart.p2.x - (this.linkStart.p2.x - this.linkStart.p1.x) * this.linkStart.dist;
    var new_y = this.linkStart.p2.y - (this.linkStart.p2.y - this.linkStart.p1.y) * this.linkStart.dist;

    // wrapping the arrow around the shape
    if (this.vertices.length > 1 && (!this.broken_end || this.vertices != 6)) {
        if (startDir == "vertical") {
            var sign_y = (this.vertices[1].y+dy - new_y > 0 ? 1 : -1);
            if (!this.broken_start) {
                // detect if line break needed
                if (this.linkStart.shape.type != "Line" && this.linkStart.shape.pointer_is_inside(new_x, 20*sign_y + new_y)) {
                    this.vertices[0].y = new_y;
                    this.vertices[1].y = new_y - sign_y*20;
                    var mid_point = this.vertices[2].add(this.vertices[1]).mul(0.5);
                    this.vertices.splice(2, 0, new Vertex(mid_point.x, this.vertices[1].y, 0));
                    this.vertices.splice(3, 0, new Vertex(mid_point.x, this.vertices[3].y, 0));
                    this.broken_start = true;
                    this.update_vertices();
                    return;
                }
            } else {
                // update the vertices
                this.vertices[2].translate(0,dy,0);
                this.vertices[1].translate(dx,dy,0);
                this.vertices[0].translate(dx,dy,0);

                // detect if line break not needed anymore
                if ((this.vertices[2].y - this.vertices[3].y)*sign_y <= 0) {
                    this.broken_start = false;
                    this.vertices.splice(2,2);
                    this.update_vertices(true);
                }
                return;
            }
        } else if (startDir == "horizontal") {
            var sign_x = (this.vertices[1].x +dx - new_x > 0 ? 1 : -1);
            if (!this.broken_start) {
                if (this.linkStart.shape.type != "Line" && this.linkStart.shape.pointer_is_inside(20*sign_x + new_x, new_y)) {
                    this.vertices[0].x = new_x;
                    this.vertices[1].x = new_x - sign_x*20;
                    var mid_point = this.vertices[2].add(this.vertices[1]).mul(0.5);
                    this.vertices.splice(2, 0, new Vertex(this.vertices[1].x, mid_point.y, 0));
                    this.vertices.splice(3, 0, new Vertex(this.vertices[3].x, mid_point.y, 0));
                    this.broken_start = true;
                    this.update_vertices();
                    return;
                }
            } else {
                this.vertices[2].translate(dx,0,0);
                this.vertices[1].translate(dx,dy,0);
                this.vertices[0].translate(dx,dy,0);

                if ((this.vertices[2].x - this.vertices[3].x)*sign_x <= 0) {
                    this.broken_start = false;
                    this.vertices.splice(2,2);
                    this.update_vertices(true);
                }
                return;
            }
        }

    }

    if (this.points > 2) {
        // just move the arrow
        if (startDir == "vertical") this.vertices[1].translate(dx,0,0);
        if (startDir == "horizontal") this.vertices[1].translate(0,dy,0);
        this.vertices[0].translate(dx,dy,0);
        this.update_vertices();
    } else if (this.points == 2) {
        // break the arrow and move it
        var newVertices = this.vertices;
        var midX, midY;
        if (this.endDir == "horizontal" && dy != 0) {
            midX = (this.vertices[0].x + this.vertices[1].x) / 2;
            newVertices = [this.vertices[0], new Vertex(midX, this.vertices[0].y, 0),
                new Vertex(midX, this.vertices[1].y, 0), this.vertices[1]];
        } else if (this.endDir == "vertical" && dx != 0) {
            midY = (this.vertices[0].y + this.vertices[1].y) / 2;
            newVertices = [this.vertices[0], new Vertex(this.vertices[0].x, midY, 0),
                new Vertex(this.vertices[1].x, midY, 0), this.vertices[1]];
        } else {
            this.vertices[0].translate(dx,dy,0);
        }
        this.vertices = newVertices;
        this.points = this.vertices.length;
        // this.update_vertices();
    }
};

Line.prototype.move_end = function(dx, dy) {
    var last = this.vertices.length-1;

    if (this.linkEnd.p2 == undefined) return;
    var new_x = this.linkEnd.p2.x - (this.linkEnd.p2.x - this.linkEnd.p1.x) * this.linkEnd.dist;
    var new_y = this.linkEnd.p2.y - (this.linkEnd.p2.y - this.linkEnd.p1.y) * this.linkEnd.dist;

    // wrapping the arrow around the shape
    if (this.vertices.length > 1) {
        if (this.endDir == "vertical") {
            var sign_y = (this.vertices[last-1].y + dy - new_y > 0 ? 1 : -1);
            if (!this.broken_end) {
                // detect if line break needed
                if (this.linkStart.shape.type != "Line" && this.linkEnd.shape.pointer_is_inside(new_x, 20*sign_y+new_y)) {
                    this.vertices[last].y = new_y;
                    this.vertices[last-1].y = new_y - sign_y * 20;
                    var mid_point = this.vertices[last-2].add(this.vertices[last-1]).mul(0.5);
                    this.vertices.splice(last-1, 0, new Vertex(mid_point.x, this.vertices[last-2].y, 0));
                    this.vertices.splice(last-1, 0, new Vertex(mid_point.x, this.vertices[last-1].y, 0));
                    this.broken_end = true;
                    this.update_vertices(true);
                    return;
                }
            } else {
                // update the vertices
                this.vertices[last-2].translate(0, dy, 0);
                this.vertices[last-1].translate(dx, dy, 0);
                this.vertices[last].translate(dx, dy, 0);

                // detect if line break not needed anymore
                if ((this.vertices[last-2].y - this.vertices[last-3].y) * sign_y <= 0) {
                    this.broken_end = false;
                    this.vertices.splice(last-3, 2);
                    this.update_vertices();
                }
                return;
            }
        } else if (this.endDir == "horizontal") {
            var sign_x = (this.vertices[last-1].x + dx - this.vertices[last].x > 0 ? 1 : -1);
            if (!this.broken_end) {
                if (this.linkStart.shape.type != "Line" && this.linkEnd.shape.pointer_is_inside(new_x + sign_x*20, new_y)) {
                    this.vertices[last].x = new_x;
                    this.vertices[last-1].x = new_x - sign_x * 20;
                    var mid_point = this.vertices[last-2].add(this.vertices[last-1]).mul(0.5);
                    this.vertices.splice(last-1, 0, new Vertex(this.vertices[last-2].x, mid_point.y, 0));
                    this.vertices.splice(last-1, 0, new Vertex(this.vertices[last-1].x, mid_point.y, 0));
                    this.broken_end = true;
                    this.update_vertices(true);
                    return;
                }
            } else {
                this.vertices[last-2].translate(dx, 0, 0);
                this.vertices[last-1].translate(dx, dy, 0);
                this.vertices[last].translate(dx, dy, 0);

                if ((this.vertices[last-2].x - this.vertices[last-3].x) * sign_x <= 0) {
                    this.broken_end = false;
                    this.vertices.splice(last - 3, 2);
                    this.update_vertices();
                }
                return;
            }
        }
    }
    // if (this.points == 6 && this.broken_start && this.vertices[last].subtract(this.vertices[last-1]).norm() < 20) {
    //     this.vertices[last-2].translate(0, dy, 0);
    //     this.vertices[last-1].translate(dx, dy, 0);
    //     this.vertices[last].translate(dx, dy, 0);
    //     return;
    // }
    if (this.points > 2 || (this.endDir == "horizontal" && dy == 0) || (this.endDir == "vertical" && dx == 0)) {
        if (this.endDir == "vertical") this.vertices[last - 1].translate(dx,0,0);
        if (this.endDir == "horizontal") this.vertices[last - 1].translate(0,dy,0);
        this.vertices[last].translate(dx,dy,0);

        this.update_vertices();
    } else if (this.points == 2) {
        var newVertices = this.vertices;
        var midX, midY;
        if (this.endDir == "horizontal" && dy != 0) {
            midX = (this.vertices[0].x + this.vertices[1].x) / 2;
            newVertices = [this.vertices[0], new Vertex(midX, this.vertices[0].y, 0),
                new Vertex(midX, this.vertices[1].y, 0), this.vertices[1]];
        } else if (this.endDir == "vertical" && dx != 0) {
            midY = (this.vertices[0].y + this.vertices[1].y) / 2;
            newVertices = [this.vertices[0], new Vertex(this.vertices[0].x, midY, 0),
                new Vertex(this.vertices[1].x, midY, 0), this.vertices[1]];
        } else {
            this.vertices[0].translate(dx,dy,0);
        }
        this.vertices = newVertices;
        this.points = this.vertices.length;
    }

};

Line.prototype.sync_start = function() {
    var new_x = this.linkStart.p2.x - (this.linkStart.p2.x - this.linkStart.p1.x) * this.linkStart.dist;
    var new_y = this.linkStart.p2.y - (this.linkStart.p2.y - this.linkStart.p1.y) * this.linkStart.dist;
    this.move_start(new_x - this.vertices[0].x, new_y - this.vertices[0].y);
};

Line.prototype.sync_end = function() {
    var new_x = this.linkEnd.p2.x - (this.linkEnd.p2.x - this.linkEnd.p1.x) * this.linkEnd.dist;
    var new_y = this.linkEnd.p2.y - (this.linkEnd.p2.y - this.linkEnd.p1.y) * this.linkEnd.dist;
    this.move_end(new_x - this.vertices[this.vertices.length-1].x, new_y - this.vertices[this.vertices.length-1].y);
};


Line.prototype.pointer_is_on_the_border = function(xm, ym, ctx) {
    var cursor = new Vertex(xm, ym, 0);
    // check if the pointer position is relevant by comparing the color under the cursor with the color of the line
    // if (!color_under_cursor_matches_given_color(this.border_color, ctx, cursor,this.stroke)) return false;

    // go over all parts of the line and check if the pointer is on them
    for (var i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[(i + 1) % this.vertices.length];
        if (point_is_on_line_between_two_points(cursor,vi,vj,this.stroke)) {
            return direction_of_line_between_two_points(vi,vj,this.stroke);
        }
    }
    return false;
};

Line.prototype.pointer_is_on_the_border_line = function(xm, ym, ctx) {
    var cursor = new Vertex(xm, ym, 0);
    // check if the pointer position is relevant by comparing the color under the cursor with the color of the line
    // if (!color_under_cursor_matches_given_color(this.border_color, ctx, cursor,this.stroke)) return false;

    // go over all lines of the border and check if the pointer is on them
    for (var i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[(i + 1) % this.vertices.length];
        if (point_is_on_line_between_two_points(cursor,vi,vj,this.stroke)) {
            var dist = relative_position_on_the_line_between_two_points(vi, vj, cursor);
            return {p1: vi, p2: vj, dist: dist};
        }
    }
    return false;
};

Line.prototype.pointer_is_on_end = function(xm, ym, ctx) {
    var pointer = new Vertex(xm, ym, 0);
    var dist = pointer.subtract(this.vertices[this.vertices.length-1]).norm();
    var radius = 5; //px
    return dist < radius;
};


Line.prototype.get_vertex_by_key = function(key) {
    for (var i = 0; i < this.vertices.length; i++) {
        if (this.vertices[i].key == key) {
            return this.vertices[i];
        }
    }
};

//////////////////////////////////
//  Shape

var Shape = function(x, y, width, height, radius, stroke, text, color, border_color, dashedBorder, key, offset, selectable, z_index) {
    if (typeof x == "object") {
        assign(this, x);
        this.default_color = new Color(this.default_color);
        this.color = new Color(this.color);
        this.default_border_color = new Color(this.default_border_color);
        this.border_color = new Color(this.border_color);
        this.set_layer(this.layer);
    } else {
        this.x = x;
        this.y = y;
        this.baseWidth = width;
        this.width = width;
        this.height = height;
        this.radius = (typeof radius != 'undefined') ? radius : 2;
        this.stroke = (typeof stroke != 'undefined') ? stroke : 1;
        this.textColor = "rgb(50,50,50)";
        this.default_color = new Color(color);
        this.color = new Color(color);
        this.default_border_color = new Color(border_color);
        this.border_color = new Color(border_color);
        this.vertices = [];
        this.dashedBorder = (typeof dashedBorder != 'undefined') ? dashedBorder : false;
        this.offset = (typeof offset != 'undefined') ? offset : 0;
        this.fillPattern = "full";
        this.selectable = (typeof selectable != 'undefined') ? selectable : true;
        this.z_index = (typeof z_index != 'undefined') ? z_index : 0;
        this.update_text((typeof text != 'undefined') ? text : "");

        this.expand = false;

        this.key = (typeof key != 'undefined') ? key : this.generate_new_key();

        this.set_layer(new Layer());
        this.full_details = false;
    }

};

Shape.prototype.generate_new_key = function() {
    this.key = new Uint32Array(1);
    window.crypto.getRandomValues(this.key);
    return this.key[0];
};

Shape.prototype.set_layer = function(layer) {
    this.layer = object_to_layer(layer);
};


Shape.prototype.clone = function() {
    var shape = object_to_shape(this);
    shape.key = shape.generate_new_key();
    shape.vertices = [];
    shape.update_vertices();
    return shape;
};

Shape.prototype.has_border_line = function(line_points) {
    var i;
    for (i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[(i + 1) % this.vertices.length];
        if (vi.key == line_points.p1.key && vj.key == line_points.p2.key) {
            return true;
        }
    }
    return false;
};

Shape.prototype.pointer_is_inside = function(xm, ym) {
    if (!this.selectable) {
        return false;
    }
    var j = this.vertices.length-1;
    var oddNodes = false;

    for (var i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[j];
        if ((vi.y < ym && vj.y >= ym || vj.y < ym && vi.y >= ym) && (vi.x <= xm || vj.x <= xm)) {
            if (vi.x + (ym - vi.y)/(vj.y-vi.y)*(vj.x - vi.x) < xm) {
                oddNodes = !oddNodes;
            }
        }
        j = i;
    }

    return oddNodes;
};


Shape.prototype.pointer_is_on_the_border = function(xm, ym, ctx) {
    if (!this.selectable) {
        return false;
    }
    var cursor = new Vertex(xm, ym, 0);
    // check if the pointer position is relevant by comparing the color under the cursor with the color of the line
    //if (!color_under_cursor_matches_given_color(this.border_color, ctx, cursor,this.stroke)) return false;

    // go over all lines of the border and check if the pointer is on them
    for (var i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[(i + 1) % this.vertices.length];
        if (point_is_on_line_between_two_points(cursor,vi,vj,this.stroke)) {
            return direction_of_line_between_two_points(vi,vj,this.stroke);
        }
    }
    return false;
};


Shape.prototype.pointer_is_on_the_border_line = function(xm, ym, ctx) {
    if (!this.selectable) {
        return false;
    }
    var cursor = new Vertex(xm, ym, 0);
    // check if the pointer position is relevant by comparing the color under the cursor with the color of the line
    //if (!color_under_cursor_matches_given_color(this.border_color, ctx, cursor,this.stroke)) return false;

    // go over all lines of the border and check if the pointer is on them
    for (var i = 0; i < this.vertices.length; i++) {
        var vi = this.vertices[i];
        var vj = this.vertices[(i + 1) % this.vertices.length];
        if (point_is_on_line_between_two_points(cursor,vi,vj,this.stroke)) {
            var dist = relative_position_on_the_line_between_two_points(vi, vj, cursor);
            return {p1: vi, p2: vj, dist: dist};
        }
    }
    return false;
};

Shape.prototype.update_vertices = function() {

};


Shape.prototype.move_to = function(x, y) {
    this.translate(x - this.x, y - this.y);
};

Shape.prototype.translate = function(dx, dy) {
    for (var i = 0; i < this.vertices.length; i++) {
        this.vertices[i].translate(dx,dy,0);
    }
    this.x += dx;
    this.y += dy;
};

Shape.prototype.update_text = function(text) {
    var textWidth = text.length * 7;
    this.text = text;
    if (textWidth > this.baseWidth) {
        this.width = textWidth;
    } else {
        this.width = this.baseWidth;
    }
    this.name = text.replace(/ /g,'_');
    this.update_vertices();
};

Shape.prototype.hide = function() {
    this.color.a = 0;
	this.border_color.a = 0;
};

Shape.prototype.show = function() {
    this.color.a = this.default_color.a;
	this.border_color.a = this.default_border_color.a;
};

Shape.prototype.change_color = function(color) {
    this.color = new Color(this.default_color);
	this.border_color = new Color(this.default_border_color);
};


Shape.prototype.change_fill_color = function(color) {
    this.color = new Color(color);
	this.default_color = new Color(color);
};

Shape.prototype.change_border_color = function(color) {
    this.border_color = new Color(color);
	this.default_border_color = new Color(color);
};


Shape.prototype.highlight = function() {
    if (this.selectable == true) {
        this.color.a = 1;
        this.textColor = "black";
    }
};

Shape.prototype.darken = function() {
    if (this.selectable == true) {
        this.textColor = "rgb(50,50,50)";
        this.color.a = 0.3;
    }
};

Shape.prototype.full = function() {
    if (!this.full_details){
        this.full_details = true;
        this.height += 10;
        this.width += 50;
        this.update_vertices();
    }
};


Shape.prototype.partial = function() {
    if (this.full_details) {
        this.full_details = false;
        this.height -= 10;
        this.width -= 50;
        this.update_vertices();
    }
};


Shape.prototype.get_vertex_by_key = function(key) {
    for (var i = 0; i < this.vertices.length; i++) {
        if (this.vertices[i].key == key) {
            return this.vertices[i];
        }
    }
};

Shape.prototype.clone_vertices = function(shape){
    this.vertices = [];
    for (var i = 0; i < shape.vertices.length; i++) {
        this.vertices.push(new Vertex(shape.vertices[i]));
    }
};

Shape.prototype.get_center = function() {
    return new Vertex(this.x, this.y, 0);
};

Shape.prototype.draw_frame = function(ctx) {
    ctx.beginPath();
    for (var v = 1; v <= this.vertices.length; v++) {
        var curr_point = this.vertices[v%this.vertices.length];
        var prev_point = this.vertices[v-1];
        var next_point = this.vertices[(v+1)%this.vertices.length];
        var pre_line_direction = unit_vector(prev_point, curr_point);
        var pre_point = curr_point.subtract(pre_line_direction.mul(this.radius));
        var post_line_direction = unit_vector(curr_point, next_point);
        var post_point = curr_point.add(post_line_direction.mul(this.radius));
        if (v == 0) {
            ctx.moveTo(pre_point.x, pre_point.y);
        }
        ctx.lineTo(pre_point.x, pre_point.y);
        ctx.quadraticCurveTo(curr_point.x, curr_point.y, post_point.x, post_point.y);
    }
    ctx.closePath();
};

Shape.prototype.draw_fill = function(ctx) {
    // draw fill
    if (this.fillPattern == "diagonal_lines") {
        var canvasPattern = document.createElement("canvas");
        canvasPattern.width = 10;
        canvasPattern.height = 10;
        var contextPattern = canvasPattern.getContext("2d");
        contextPattern.lineWidth = 2;
        contextPattern.strokeStyle = "#666";
        contextPattern.beginPath();
        contextPattern.moveTo(-1, -1);
        contextPattern.lineTo(11, 11);
        contextPattern.stroke();

        var pattern = ctx.createPattern(canvasPattern,"repeat");
        ctx.fillStyle = pattern;
    } else {
        ctx.fillStyle = this.color.to_string();
    }
    ctx.fill();
};

Shape.prototype.draw_stroke = function(ctx) {
    // draw border
    if (this.stroke > 0) {
        if (this.dashedBorder) {
            ctx.setLineDash([6,9]);
        }
        ctx.strokeStyle = this.border_color.to_string();
        ctx.lineWidth = this.stroke;
        ctx.stroke();
        ctx.setLineDash([0,0]);
    }
};

Shape.prototype.draw_text = function(ctx) {
    // draw text
    if (!this.full_details || this.layer.description == "") {
        ctx.font = "bold 14px Calibri";
        ctx.textAlign = "center";
        ctx.fillStyle = this.textColor;
        ctx.fillText(this.text, this.x, this.y + 3);
    } else {
        ctx.font = "bold 14px Calibri";

        ctx.textAlign = "center";
        ctx.fillStyle = this.textColor;
        ctx.fillText(this.text, this.x, this.y - 5);

        ctx.font = "11px Calibri";
        ctx.textAlign = "center";
        ctx.fillStyle = this.textColor;
        ctx.fillText(this.layer.description, this.x, this.y + 13);
    }
};

Shape.prototype.draw = function(ctx) {
    this.draw_frame(ctx);
    this.draw_fill(ctx);
    this.draw_stroke(ctx);
    this.draw_text(ctx);
};

Shape.prototype.rotate = function() {
    var delta = 15;
    if (this.width > 0 && !this.expand) {
        this.width -= delta;
        this.expand = false;
    } else if (this.width > this.baseWidth) {
        this.width = this.baseWidth;
        this.expand = false;
        return true;
    } else {
        this.expand = true;
        this.width += delta;
    }
    this.update_vertices();
    return false;
};

/////////////////////////////////////
//  Rectangle

var Rectangle = function(x, y, width, height, radius, offset, stroke, text, color, border_color, dashedBorder, key, corner_anchor, selectable, z_index) {
    if (typeof x == "object") {
        // copy constructor
        var shape = x;
        Shape.call(this, shape);
        this.clone_vertices(shape);
        this.offset = shape.offset;
    } else {
        Shape.call(this, x, y, width, height, radius, stroke, text, color, border_color, dashedBorder, key, offset, selectable, z_index);
        this.offset = (typeof offset != 'undefined') ? offset : 10;
        this.corner_anchor = (typeof corner_anchor != 'undefined') ? corner_anchor : false;
    }
    this.update_vertices();
    this.type = "Rectangle";
};

inheritsFrom(Rectangle, Shape);

Rectangle.prototype.update_vertices = function() {
    var keys = [];
    for (var i = 0; i < this.vertices.length; i++) {
        keys.push(this.vertices[i].key);
    }
    if (this.corner_anchor) {
        this.vertices = [
            new Vertex(this.x, this.y, 0, keys[0]),
            new Vertex(this.x + this.width, this.y, 0, keys[1]),
            new Vertex(this.x + this.width - this.offset, this.y + this.height, 0, keys[2]),
            new Vertex(this.x - this.offset, this.y + this.height, 0, keys[3])
        ];
    } else {
        this.vertices = [
            new Vertex(this.x - this.width/2 + this.offset/2, this.y - this.height/2, 0, keys[0]),
            new Vertex(this.x + this.width/2 + this.offset/2, this.y - this.height/2, 0, keys[1]),
            new Vertex(this.x + this.width/2 - this.offset/2, this.y + this.height/2, 0, keys[2]),
            new Vertex(this.x - this.width/2 - this.offset/2, this.y + this.height/2, 0, keys[3])
        ];
    }
};

/////////////////////////////////////
//  Trapezoid

var Trapezoid = function(x, y, width, height, radius, offset, stroke, text, color, border_color, dashedBorder, key, selectable, z_index) {
    if (typeof x == "object") {
        // copy constructor
        var shape = x;
        Shape.call(this, shape);
        this.clone_vertices(shape);
        this.offset = shape.offset;
    } else {
        Shape.call(this, x, y, width, height, radius, stroke, text, color, border_color, dashedBorder, key, offset, selectable, z_index);
        this.offset = (typeof offset != 'undefined') ? offset : 10;
    }
    this.update_vertices();
    this.type = "Trapezoid";
};

inheritsFrom(Trapezoid, Shape);

Trapezoid.prototype.update_vertices = function() {
    var keys = [];
    for (var i = 0; i < this.vertices.length; i++) {
        keys.push(this.vertices[i].key);
    }

    this.vertices = [
        new Vertex(this.x - this.width/2 + this.offset/2, this.y - this.height/2, 0, keys[0]),
        new Vertex(this.x + this.width/2 - this.offset/2, this.y - this.height/2, 0, keys[1]),
        new Vertex(this.x + this.width/2, this.y + this.height/2, 0, keys[2]),
        new Vertex(this.x - this.width/2, this.y + this.height/2, 0, keys[3])
    ];
};


/////////////////////////////////////
//  Triangle

var Triangle = function(x, y, width, height, radius, stroke, text, color, border_color, key, selectable, z_index) {
    if (typeof x == "object") {
        // copy constructor
        var shape = x;
        Shape.call(this, shape);
        this.clone_vertices(shape);
    } else {
        Shape.call(this, x, y, width, height, radius, stroke, text, color, border_color, key, selectable, z_index);
        this.update_vertices();
    }
    this.type = "Triangle";
};

inheritsFrom(Triangle, Shape);


Triangle.prototype.update_vertices = function() {
    var keys = [];
    for (var i = 0; i < this.vertices.length; i++) {
        keys.push(this.vertices[i].key);
    }
    this.vertices = [
        new Vertex(this.x - this.width/2, this.y - this.height/2, 0, keys[0]),
        new Vertex(this.x + this.width/2, this.y, 0, keys[1]),
        new Vertex(this.x - this.width/2, this.y + this.height/2, 0, keys[2])
    ];
};


/////////////////////////////////////
//  Diamond

var Diamond = function(x, y, width, height, radius, stroke, text, color, border_color, key, selectable, z_index) {
    if (typeof x == "object") {
        // copy constructor
        var shape = x;
        Shape.call(this, shape);
        this.clone_vertices(shape);
    } else {
        Shape.call(this, x, y, width, height, radius, stroke, text, color, border_color, key, selectable, z_index);
        this.update_vertices();
    }
    this.type = "Diamond";
};

inheritsFrom(Diamond, Shape);

Diamond.prototype.update_vertices = function() {
    var keys = [];
    for (var i = 0; i < this.vertices.length; i++) {
        keys.push(this.vertices[i].key);
    }
    this.vertices = [
        new Vertex(this.x, this.y - this.height/2, 0, keys[0]),
        new Vertex(this.x + this.width/2, this.y, 0, keys[1]),
        new Vertex(this.x, this.y + this.height/2, 0, keys[2]),
        new Vertex(this.x - this.width/2, this.y, 0, keys[3])
    ];
};

/////////////////////////////////////
//  Hexagon

var Hexagon = function(x, y, width, height, radius, stroke, text, color, border_color, key, selectable, z_index) {
    if (typeof x == "object") {
        // copy constructor
        var shape = x;
        Shape.call(this, shape);
        this.clone_vertices(shape);
    } else {
        Shape.call(this, x, y, width, height, radius, stroke, text, color, border_color, key, selectable, z_index);
        this.update_vertices();
    }
    this.type = "Hexagon";
};

inheritsFrom(Hexagon, Shape);

Hexagon.prototype.update_vertices = function() {
    var keys = [];
    for (var i = 0; i < this.vertices.length; i++) {
        keys.push(this.vertices[i].key);
    }
    var side = this.width/2;
    this.vertices = [
        new Vertex(this.x - side/2, this.y - this.height/2, 0, keys[0]),
        new Vertex(this.x + side/2, this.y - this.height/2, 0, keys[1]),
        new Vertex(this.x + this.width/2, this.y, 0, keys[2]),
        new Vertex(this.x + side/2, this.y + this.height/2, 0, keys[3]),
        new Vertex(this.x - side/2, this.y + this.height/2, 0, keys[4]),
        new Vertex(this.x - this.width/2, this.y, 0, keys[5])
    ];
};


/////////////////////////////////////
//  Step

var Step = function(x, y, width, height, radius, offset, stroke, text, color, border_color, key, selectable, z_index) {
    if (typeof x == "object") {
        // copy constructor
        var shape = x;
        Shape.call(this, shape);
        this.offset = shape.offset;
        this.clone_vertices(shape);
    } else {
        Shape.call(this, x, y, width, height, radius, stroke, text, color, border_color, key, selectable, z_index);
        this.offset = (typeof offset != 'undefined') ? offset : 10;
        this.update_vertices();
    }
    this.type = "Step";
};

inheritsFrom(Step, Shape);

Step.prototype.update_vertices = function() {
    var keys = [];
    for (var i = 0; i < this.vertices.length; i++) {
        keys.push(this.vertices[i].key);
    }
    this.vertices = [
        new Vertex(this.x - this.width/2, this.y - this.height/2, 0, keys[0]),
        new Vertex(this.x + this.width/2 - this.offset, this.y - this.height/2, 0, keys[1]),
        new Vertex(this.x + this.width/2, this.y, 0, keys[2]),
        new Vertex(this.x + this.width/2 - this.offset, this.y + this.height/2, 0, keys[3]),
        new Vertex(this.x - this.width/2, this.y + this.height/2, 0, keys[4]),
        new Vertex(this.x - this.width/2 + this.offset, this.y, 0, keys[5])
    ];
};

/////////////////////////////////////
//  Ellipse

var Ellipse = function(x, y, width, height, stroke, text, color, border_color, key, selectable, z_index) {
    if (typeof x == "object") {
        // copy constructor
        var shape = x;
        Shape.call(this, shape);
        this.clone_vertices(shape);
    } else {
        Shape.call(this, x, y, width, height, 0, stroke, text, color, border_color, false, key, selectable, z_index);
        this.vertices = [];
        this.type = "Ellipse";
        this.update_vertices();
    }
};

inheritsFrom(Ellipse, Shape);

Ellipse.prototype.update_vertices = function() {
    var keys = [];
    for (var i = 0; i < this.vertices.length; i++) {
        keys.push(this.vertices[i].key);
    }
    this.vertices = [];
    var num_vertices = 36;
    for (var i = 0; i < num_vertices; i++) {
        this.vertices.push(new Vertex(this.x + (this.width/2)*Math.cos(i*2*Math.PI/num_vertices),
            this.y + (this.height/2)*Math.sin(i*2*Math.PI/num_vertices), 0, keys[i]));
    }
};

/////////////////////////////////////
//  HalfCircle

var HalfCircle = function(x, y, width, height, stroke, text, color, border_color, key, selectable, z_index) {
    if (typeof x == "object") {
        // copy constructor
        var shape = x;
        Shape.call(this, shape);
        this.clone_vertices(shape);
    } else {
        Shape.call(this, x, y, width, height, 0, stroke, text, color, border_color, false, key, selectable, z_index);
        this.vertices = [];
        this.type = "HalfCircle";
        this.update_vertices();
    }
};

inheritsFrom(HalfCircle, Shape);

HalfCircle.prototype.update_vertices = function() {
    var keys = [];
    for (var i = 0; i < this.vertices.length; i++) {
        keys.push(this.vertices[i].key);
    }
    this.vertices = [];
    var num_vertices = 18;
    for (var i = -num_vertices/4; i < num_vertices/4+1; i++) {
        this.vertices.push(new Vertex(this.x + (this.width/2)*Math.cos(i*2*Math.PI/num_vertices),
            this.y + (this.height/2)*Math.sin(i*2*Math.PI/num_vertices), 0, keys[i]));
    }
};
