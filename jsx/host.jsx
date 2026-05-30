/* SpectraFlow CEP host script for After Effects */

(function () {
    if (!$._SpectraFlow) {
        $._SpectraFlow = {};
    }

    function parsePayload(text) {
        try {
            return JSON.parse(text || "{}");
        } catch (e) {
            return eval("(" + (text || "{}") + ")");
        }
    }

    function stringify(value) {
        if (typeof JSON !== "undefined" && JSON.stringify) {
            return JSON.stringify(value);
        }
        if (value === null) return "null";
        if (value instanceof Array) {
            var arr = [];
            for (var i = 0; i < value.length; i++) arr.push(stringify(value[i]));
            return "[" + arr.join(",") + "]";
        }
        if (typeof value === "object") {
            var parts = [];
            for (var key in value) {
                if (value.hasOwnProperty(key)) {
                    parts.push(stringify(key) + ":" + stringify(value[key]));
                }
            }
            return "{" + parts.join(",") + "}";
        }
        if (typeof value === "string") {
            return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n") + '"';
        }
        if (typeof value === "boolean") return value ? "true" : "false";
        return String(Number(value) || 0);
    }

    function ok(data) {
        data = data || {};
        data.ok = true;
        return stringify(data);
    }

    function fail(message) {
        return stringify({ ok: false, message: message || "Unknown error" });
    }

    function clamp(value, min, max) {
        value = Number(value);
        if (isNaN(value)) return min;
        return Math.max(min, Math.min(max, value));
    }

    function activeComp() {
        var item = app.project && app.project.activeItem;
        return (item && item instanceof CompItem) ? item : null;
    }

    function isUsableProperty(prop) {
        return prop &&
            prop.propertyType === PropertyType.PROPERTY &&
            prop.canVaryOverTime &&
            prop.numKeys > 0;
    }

    function collectFromGroup(group, output) {
        if (!group || !group.numProperties) return;
        for (var i = 1; i <= group.numProperties; i++) {
            var child = group.property(i);
            if (isUsableProperty(child)) {
                output.push(child);
            } else if (child && child.numProperties) {
                collectFromGroup(child, output);
            }
        }
    }

    function selectedProperties() {
        var comp = activeComp();
        var output = [];
        if (!comp) return output;

        var selected = comp.selectedProperties;
        for (var i = 0; i < selected.length; i++) {
            if (isUsableProperty(selected[i])) {
                output.push(selected[i]);
            } else if (selected[i] && selected[i].numProperties) {
                collectFromGroup(selected[i], output);
            }
        }

        if (output.length === 0) {
            var layers = comp.selectedLayers;
            for (var j = 0; j < layers.length; j++) {
                collectFromGroup(layers[j], output);
            }
        }

        return output;
    }

    function keysForProperty(prop, applyAll) {
        var keys = [];
        try {
            keys = prop.selectedKeys;
        } catch (err) {
            keys = [];
        }

        if ((!keys || keys.length === 0) && applyAll) {
            keys = [];
            for (var i = 1; i <= prop.numKeys; i++) {
                keys.push(i);
            }
        }
        return keys || [];
    }

    function easeLength(prop, keyIndex) {
        try {
            return prop.keyInTemporalEase(keyIndex).length;
        } catch (err) {
            return 1;
        }
    }

    function componentValue(value, componentIndex, componentCount) {
        if (value instanceof Array) {
            if (componentCount === 1) {
                var total = 0;
                for (var i = 0; i < value.length; i++) {
                    var n = Number(value[i]) || 0;
                    total += n * n;
                }
                return Math.sqrt(total);
            }
            return componentIndex < value.length ? Number(value[componentIndex]) || 0 : 0;
        }
        return Number(value) || 0;
    }

    function segmentSpeed(prop, keyIndex, componentIndex, componentCount, incoming) {
        var aIndex, bIndex;

        if (incoming) {
            if (keyIndex <= 1) return 0;
            aIndex = keyIndex - 1;
            bIndex = keyIndex;
        } else {
            if (keyIndex >= prop.numKeys) return 0;
            aIndex = keyIndex;
            bIndex = keyIndex + 1;
        }

        var dt = prop.keyTime(bIndex) - prop.keyTime(aIndex);
        if (dt === 0) return 0;

        var a = componentValue(prop.keyValue(aIndex), componentIndex, componentCount);
        var b = componentValue(prop.keyValue(bIndex), componentIndex, componentCount);
        return (b - a) / dt;
    }

    function outInfluence(curve) {
        return clamp(curve.x1 * 100, 0.1, 100);
    }

    function inInfluence(curve) {
        return clamp((1 - curve.x2) * 100, 0.1, 100);
    }

    function outSlope(curve) {
        return Math.abs(curve.x1) < 0.0001 ? 0 : curve.y1 / curve.x1;
    }

    function inSlope(curve) {
        var dx = 1 - curve.x2;
        return Math.abs(dx) < 0.0001 ? 0 : (1 - curve.y2) / dx;
    }

    function makeEaseArray(prop, keyIndex, incoming, curve) {
        var count = easeLength(prop, keyIndex);
        var influence = incoming ? inInfluence(curve) : outInfluence(curve);
        var graphMode = String(curve.graphMode || "value");
        var slope = incoming ? inSlope(curve) : outSlope(curve);
        var speedMultiplier = incoming ? curve.y2 : curve.y1;
        var output = [];

        for (var i = 0; i < count; i++) {
            var baseSpeed = segmentSpeed(prop, keyIndex, i, count, incoming);
            var speed;
            if (graphMode === "speed") {
                speed = baseSpeed * clamp(speedMultiplier, 0, 3);
            } else {
                speed = baseSpeed * slope;
            }
            if (!isFinite(speed) || isNaN(speed)) speed = 0;
            output.push(new KeyframeEase(speed, influence));
        }
        return output;
    }

    function safeCurve(curve) {
        curve = curve || {};
        return {
            name: String(curve.name || "Custom Curve"),
            group: String(curve.group || "Custom"),
            x1: clamp(curve.x1, 0.01, 0.99),
            y1: clamp(curve.y1, -0.75, 1.75),
            x2: clamp(curve.x2, 0.01, 0.99),
            y2: clamp(curve.y2, -0.75, 1.75),
            interpolation: String(curve.interpolation || "bezier"),
            graphMode: String(curve.graphMode || "value")
        };
    }

    $._SpectraFlow.applyEase = function (payloadText) {
        try {
            var payload = parsePayload(payloadText);
            var curve = safeCurve(payload.curve);
            var options = payload.options || {};
            var props = selectedProperties();
            var applied = 0, skipped = 0, failed = 0;

            if (props.length === 0) {
                return fail("Select animated keyframes, properties, or layers first.");
            }

            app.beginUndoGroup("SpectraFlow - " + curve.name);

            for (var i = 0; i < props.length; i++) {
                var prop = props[i];
                var keys = keysForProperty(prop, !!options.applyAll);
                if (!keys || keys.length === 0) {
                    skipped++;
                    continue;
                }

                for (var j = 0; j < keys.length; j++) {
                    var keyIndex = keys[j];
                    try {
                        if (curve.graphMode === "value" && curve.interpolation === "linear") {
                            prop.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
                            applied++;
                            continue;
                        }

                        prop.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);

                        try {
                            prop.setTemporalContinuousAtKey(keyIndex, !!options.continuous);
                        } catch (err1) {}

                        try {
                            prop.setTemporalAutoBezierAtKey(keyIndex, !!options.autoBezier);
                        } catch (err2) {}

                        prop.setTemporalEaseAtKey(
                            keyIndex,
                            makeEaseArray(prop, keyIndex, true, curve),
                            makeEaseArray(prop, keyIndex, false, curve)
                        );
                        applied++;
                    } catch (err3) {
                        failed++;
                    }
                }
            }

            app.endUndoGroup();

            if (applied === 0) {
                return fail("No keyframes changed.");
            }

            return ok({ applied: applied, skipped: skipped, failed: failed });
        } catch (err) {
            try { app.endUndoGroup(); } catch (ignore) {}
            return fail(err.toString());
        }
    };

    $._SpectraFlow.captureEase = function (payloadText) {
        try {
            var payload = parsePayload(payloadText);
            var options = payload.options || {};
            var fallback = safeCurve(payload.curve);
            var graphMode = String((options && options.graphMode) || fallback.graphMode || "value");
            var props = selectedProperties();
            var x1Total = 0, y1Total = 0, x2Total = 0, y2Total = 0, outCount = 0, inCount = 0;

            for (var i = 0; i < props.length; i++) {
                var prop = props[i];
                var keys = keysForProperty(prop, !!options.applyAll);
                if (!keys || keys.length === 0) continue;

                for (var j = 0; j < keys.length; j++) {
                    var keyIndex = keys[j];
                    try {
                        var componentCount = easeLength(prop, keyIndex);
                        var outEase = prop.keyOutTemporalEase(keyIndex);
                        var inEase = prop.keyInTemporalEase(keyIndex);

                        if (keyIndex < prop.numKeys && outEase) {
                            for (var oi = 0; oi < outEase.length; oi++) {
                                var outInf = clamp((Number(outEase[oi].influence) || 33.333) / 100, 0.01, 0.99);
                                var baseOut = segmentSpeed(prop, keyIndex, oi, componentCount, false);
                                if (Math.abs(baseOut) > 0.00001) {
                                    x1Total += outInf;
                                    if (graphMode === "speed") {
                                        y1Total += clamp((Number(outEase[oi].speed) || 0) / baseOut, 0, 1.75);
                                    } else {
                                        y1Total += clamp(((Number(outEase[oi].speed) || 0) / baseOut) * outInf, -0.75, 1.75);
                                    }
                                    outCount++;
                                }
                            }
                        }

                        if (keyIndex > 1 && inEase) {
                            for (var ii = 0; ii < inEase.length; ii++) {
                                var inInf = clamp((Number(inEase[ii].influence) || 33.333) / 100, 0.01, 0.99);
                                var baseIn = segmentSpeed(prop, keyIndex, ii, componentCount, true);
                                if (Math.abs(baseIn) > 0.00001) {
                                    var x2 = clamp(1 - inInf, 0.01, 0.99);
                                    var slope = (Number(inEase[ii].speed) || 0) / baseIn;
                                    x2Total += x2;
                                    if (graphMode === "speed") {
                                        y2Total += clamp(slope, 0, 1.75);
                                    } else {
                                        y2Total += clamp(1 - slope * inInf, -0.75, 1.75);
                                    }
                                    inCount++;
                                }
                            }
                        }
                    } catch (errInner) {}
                }
            }

            if (outCount === 0 && inCount === 0) {
                return fail("Select eased keyframes first.");
            }

            if (outCount > 0) {
                fallback.x1 = x1Total / outCount;
                fallback.y1 = y1Total / outCount;
            }
            if (inCount > 0) {
                fallback.x2 = x2Total / inCount;
                fallback.y2 = y2Total / inCount;
            }
            fallback.name = "Read Curve";
            fallback.group = "Custom";
            fallback.graphMode = graphMode;
            return ok({ curve: safeCurve(fallback) });
        } catch (err) {
            return fail(err.toString());
        }
    };

    $._SpectraFlow.selectionInfo = function (payloadText) {
        try {
            var payload = parsePayload(payloadText);
            var options = payload.options || {};
            var props = selectedProperties();
            var result = {
                props: props.length,
                keys: 0,
                avgDuration: 0,
                scale: 0,
                opacity: 0,
                position: 0,
                camera: 0
            };
            var durationTotal = 0, durationCount = 0;

            for (var i = 0; i < props.length; i++) {
                var prop = props[i];
                var name = "";
                try {
                    name = String(prop.name || prop.matchName || "").toLowerCase();
                } catch (errName) {}
                
                if (name.indexOf("scale") >= 0) result.scale++;
                if (name.indexOf("opacity") >= 0) result.opacity++;
                if (name.indexOf("position") >= 0) result.position++;
                if (name.indexOf("camera") >= 0 || name.indexOf("zoom") >= 0 || name.indexOf("focus") >= 0) result.camera++;

                var keys = keysForProperty(prop, !!options.applyAll);
                if ((!keys || keys.length === 0) && prop.numKeys > 0) {
                    keys = [];
                    for (var k = 1; k <= prop.numKeys; k++) {
                        keys.push(k);
                    }
                }
                result.keys += keys.length;

                for (var j = 0; j < keys.length; j++) {
                    if (keys[j] < prop.numKeys) {
                        durationTotal += Math.abs(prop.keyTime(keys[j] + 1) - prop.keyTime(keys[j]));
                        durationCount++;
                    }
                }
            }

            result.avgDuration = durationCount ? durationTotal / durationCount : 0;
            return ok(result);
        } catch (err) {
            return fail(err.toString());
        }
    };
})();