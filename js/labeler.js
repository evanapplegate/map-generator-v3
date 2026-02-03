/**
 * D3-Labeler - Automatic label placement using simulated annealing
 * Based on https://github.com/tinker10/D3-Labeler
 * Modified for map label collision avoidance with fixed anchor support
 */

(function() {

d3.labeler = function() {
    var lab = [],
        anc = [],
        fixedAnchors = [], // Additional fixed obstacles (like state labels)
        w = 1,
        h = 1,
        labeler = {};

    var max_move = 3.0,     // Reduced to keep labels closer
        max_angle = 0.3,    // Reduced rotation range
        acc = 0,
        rej = 0;

    // weights
    var w_len = 0.3,        // leader line length - keep labels reasonably close
        w_inter = 0.0,      // leader line intersection - disabled
        w_lab2 = 5.0,       // label-label overlap - LOW, let them overlap if needed
        w_lab_anc = 10.0,   // label-anchor overlap - moderate
        w_fixed = 100.0,    // fixed anchor (state/country labels) overlap - VERY HIGH priority
        w_leader_cross = 0.0; // disabled - no leader lines

    var user_energy = false,
        user_schedule = false;

    var user_defined_energy, 
        user_defined_schedule;

    energy = function(index) {
        var m = lab.length, 
            ener = 0,
            dx = lab[index].x - anc[index].x,
            dy = anc[index].y - lab[index].y,
            dist = Math.sqrt(dx * dx + dy * dy),
            overlap = true,
            amount = 0,
            theta = 0;

        // penalty for length of leader line - no orientation bias
        // Labels can go anywhere (above/below/left/right) with equal preference
        if (dist > 0) ener += dist * w_len;

        var x21 = lab[index].x,
            y21 = lab[index].y - lab[index].height + 2.0,
            x22 = lab[index].x + lab[index].width,
            y22 = lab[index].y + 2.0;
        var x11, x12, y11, y12, x_overlap, y_overlap, overlap_area;

        for (var i = 0; i < m; i++) {
            if (i != index) {
                // penalty for intersection of leader lines
                overlap = intersect(anc[index].x, lab[index].x, anc[i].x, lab[i].x,
                                    anc[index].y, lab[index].y, anc[i].y, lab[i].y);
                if (overlap) ener += w_inter;

                // penalty for label-label overlap
                x11 = lab[i].x;
                y11 = lab[i].y - lab[i].height + 2.0;
                x12 = lab[i].x + lab[i].width;
                y12 = lab[i].y + 2.0;
                x_overlap = Math.max(0, Math.min(x12,x22) - Math.max(x11,x21));
                y_overlap = Math.max(0, Math.min(y12,y22) - Math.max(y11,y21));
                overlap_area = x_overlap * y_overlap;
                ener += (overlap_area * w_lab2);
            }

            // penalty for label-anchor overlap
            x11 = anc[i].x - anc[i].r;
            y11 = anc[i].y - anc[i].r;
            x12 = anc[i].x + anc[i].r;
            y12 = anc[i].y + anc[i].r;
            x_overlap = Math.max(0, Math.min(x12,x22) - Math.max(x11,x21));
            y_overlap = Math.max(0, Math.min(y12,y22) - Math.max(y11,y21));
            overlap_area = x_overlap * y_overlap;
            ener += (overlap_area * w_lab_anc);
        }

        // penalty for overlapping with fixed anchors (state labels) - higher weight
        for (var j = 0; j < fixedAnchors.length; j++) {
            var fa = fixedAnchors[j];
            x11 = fa.x;
            y11 = fa.y;
            x12 = fa.x + fa.width;
            y12 = fa.y + fa.height;
            x_overlap = Math.max(0, Math.min(x12,x22) - Math.max(x11,x21));
            y_overlap = Math.max(0, Math.min(y12,y22) - Math.max(y11,y21));
            overlap_area = x_overlap * y_overlap;
            ener += (overlap_area * w_fixed);
            
            // penalty for leader line crossing fixed anchors (state labels)
            if (lineIntersectsRect(anc[index].x, anc[index].y, lab[index].x, lab[index].y, 
                                   fa.x, fa.y, fa.x + fa.width, fa.y + fa.height)) {
                ener += w_leader_cross;
            }
        }
        
        // penalty for leader line crossing other labels
        for (var k = 0; k < m; k++) {
            if (k != index) {
                var lx1 = lab[k].x;
                var ly1 = lab[k].y - lab[k].height + 2.0;
                var lx2 = lab[k].x + lab[k].width;
                var ly2 = lab[k].y + 2.0;
                if (lineIntersectsRect(anc[index].x, anc[index].y, lab[index].x, lab[index].y,
                                       lx1, ly1, lx2, ly2)) {
                    ener += w_leader_cross;
                }
            }
        }

        return ener;
    };

    mcmove = function(currT) {
        var i = Math.floor(Math.random() * lab.length); 

        var x_old = lab[i].x;
        var y_old = lab[i].y;

        var old_energy;
        if (user_energy) { old_energy = user_defined_energy(i, lab, anc); }
        else { old_energy = energy(i); }

        lab[i].x += (Math.random() - 0.5) * max_move;
        lab[i].y += (Math.random() - 0.5) * max_move;

        // hard wall boundaries
        if (lab[i].x > w) lab[i].x = x_old;
        if (lab[i].x < 0) lab[i].x = x_old;
        if (lab[i].y > h) lab[i].y = y_old;
        if (lab[i].y < 0) lab[i].y = y_old;

        var new_energy;
        if (user_energy) { new_energy = user_defined_energy(i, lab, anc); }
        else { new_energy = energy(i); }

        var delta_energy = new_energy - old_energy;

        if (Math.random() < Math.exp(-delta_energy / currT)) {
            acc += 1;
        } else {
            lab[i].x = x_old;
            lab[i].y = y_old;
            rej += 1;
        }
    };

    mcrotate = function(currT) {
        var i = Math.floor(Math.random() * lab.length); 

        var x_old = lab[i].x;
        var y_old = lab[i].y;

        var old_energy;
        if (user_energy) { old_energy = user_defined_energy(i, lab, anc); }
        else { old_energy = energy(i); }

        var angle = (Math.random() - 0.5) * max_angle;
        var s = Math.sin(angle);
        var c = Math.cos(angle);

        lab[i].x -= anc[i].x;
        lab[i].y -= anc[i].y;

        var x_new = lab[i].x * c - lab[i].y * s,
            y_new = lab[i].x * s + lab[i].y * c;

        lab[i].x = x_new + anc[i].x;
        lab[i].y = y_new + anc[i].y;

        // hard wall boundaries
        if (lab[i].x > w) lab[i].x = x_old;
        if (lab[i].x < 0) lab[i].x = x_old;
        if (lab[i].y > h) lab[i].y = y_old;
        if (lab[i].y < 0) lab[i].y = y_old;

        var new_energy;
        if (user_energy) { new_energy = user_defined_energy(i, lab, anc); }
        else { new_energy = energy(i); }

        var delta_energy = new_energy - old_energy;

        if (Math.random() < Math.exp(-delta_energy / currT)) {
            acc += 1;
        } else {
            lab[i].x = x_old;
            lab[i].y = y_old;
            rej += 1;
        }
    };

    intersect = function(x1, x2, x3, x4, y1, y2, y3, y4) {
        var mua, mub;
        var denom, numera, numerb;

        denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        numera = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
        numerb = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);

        mua = numera / denom;
        mub = numerb / denom;
        if (!(mua < 0 || mua > 1 || mub < 0 || mub > 1)) {
            return true;
        }
        return false;
    };
    
    // Check if a line segment intersects a rectangle
    lineIntersectsRect = function(x1, y1, x2, y2, rx1, ry1, rx2, ry2) {
        // Check if line intersects any of the 4 edges of the rectangle
        // Top edge
        if (lineIntersectsLine(x1, y1, x2, y2, rx1, ry1, rx2, ry1)) return true;
        // Bottom edge
        if (lineIntersectsLine(x1, y1, x2, y2, rx1, ry2, rx2, ry2)) return true;
        // Left edge
        if (lineIntersectsLine(x1, y1, x2, y2, rx1, ry1, rx1, ry2)) return true;
        // Right edge
        if (lineIntersectsLine(x1, y1, x2, y2, rx2, ry1, rx2, ry2)) return true;
        return false;
    };
    
    // Check if two line segments intersect
    lineIntersectsLine = function(x1, y1, x2, y2, x3, y3, x4, y4) {
        var denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        if (Math.abs(denom) < 0.0001) return false; // parallel
        
        var ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
        var ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
        
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    };

    cooling_schedule = function(currT, initialT, nsweeps) {
        return (currT - (initialT / nsweeps));
    };

    labeler.start = function(nsweeps) {
        var m = lab.length,
            currT = 1.0,
            initialT = 1.0;

        for (var i = 0; i < nsweeps; i++) {
            for (var j = 0; j < m; j++) { 
                if (Math.random() < 0.5) { mcmove(currT); }
                else { mcrotate(currT); }
            }
            currT = cooling_schedule(currT, initialT, nsweeps);
        }
        return labeler;
    };

    labeler.width = function(x) {
        if (!arguments.length) return w;
        w = x;
        return labeler;
    };

    labeler.height = function(x) {
        if (!arguments.length) return h;
        h = x; 
        return labeler;
    };

    labeler.label = function(x) {
        if (!arguments.length) return lab;
        lab = x;
        return labeler;
    };

    labeler.anchor = function(x) {
        if (!arguments.length) return anc;
        anc = x;
        return labeler;
    };

    labeler.fixedAnchors = function(x) {
        if (!arguments.length) return fixedAnchors;
        fixedAnchors = x;
        return labeler;
    };

    labeler.alt_energy = function(x) {
        if (!arguments.length) return energy;
        user_defined_energy = x;
        user_energy = true;
        return labeler;
    };

    labeler.alt_schedule = function(x) {
        if (!arguments.length) return cooling_schedule;
        user_defined_schedule = x;
        user_schedule = true;
        return labeler;
    };

    return labeler;
};

})();
