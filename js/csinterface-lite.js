/* Adobe CSXS - CSInterface Lite (Minimal) */

if (typeof CSInterface === 'undefined') {
    var CSInterface = function() {
        this.runtime = null;
    };

    CSInterface.prototype.evalScript = function(script, callback) {
        console.log('[SpectraFlow] EvalScript:', script.substring(0, 100));
        
        if (typeof callback === 'function') {
            try {
                var result = eval('(' + script + ')');
                callback(result);
                return result;
            } catch(e) {
                console.error('[SpectraFlow] Error:', e.toString());
                callback('{"ok":false,"message":"' + e.toString() + '"}');
                return '{"ok":false,"message":"Error"}'; 
            }
        } else {
            try {
                return eval('(' + script + ')');
            } catch(e) {
                console.error('[SpectraFlow] Error:', e.toString());
                return '{"ok":false,"message":"Error"}';
            }
        }
    };

    CSInterface.prototype.addEventListener = function(type, callback) {
        console.log('[SpectraFlow] Event listener:', type);
    };

    CSInterface.prototype.removeEventListener = function(type, callback) {};
    CSInterface.prototype.dispatchEvent = function(event) {};
    CSInterface.prototype.getSystemPath = function(pathType) { return ''; };
    CSInterface.prototype.getExtensionState = function(key) { return ''; };
    CSInterface.prototype.setExtensionState = function(key, value) {};
}

/* Adobe CSXS - Basic Stubs */
if (typeof SystemPath === 'undefined') {
    var SystemPath = {
        EXTENSION: 0,
        COMMON_FILES: 1,
        USER_DATA: 2,
        USER_DOCUMENTS: 3,
        APPLICATION: 4
    };
}