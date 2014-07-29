// ==UserScript==
// @name			L'TUR Bahn Form Saver
// @description		Saves entered form data on bahn.ltur.com via
//					GM_saveValue and restores it upon next page visit,
//					optionally including XOR encrypted credit card data
// @version			0.1
// @namespace		https://bahn.ltur.com/ltb/booking/*
// @include			https://bahn.ltur.com/ltb/booking/*
// @require			http://code.jquery.com/jquery-latest.min.js
// @require			http://underscorejs.org/underscore-min.js
// @downloadURL		https://github.com/exilef/userscripts/raw/master/lturbahn.user.js
// @updateURL		https://github.com/exilef/userscripts/raw/master/lturbahn.user.js
// ==/UserScript==

var formSaveName='LTURForm';
var DEBUG=false;

function exec(fn) {
    var script = document.createElement('script');
    script.setAttribute("type", "application/javascript");
    script.textContent = '(' + fn + ')();';
    document.body.appendChild(script); // run the script
    document.body.removeChild(script); // clean up
}

// simple XOR cipher
// from https://gist.github.com/sukima/5613286
var XORCipher = {
    encode: function(key, data) {
        data = xor_encrypt(key, data);
        return b64_encode(data);
    },
    decode: function(key, data) {
        data = b64_decode(data);
        return xor_decrypt(key, data);
    }
};

var b64_table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

function b64_encode(data) {
    var o1, o2, o3, h1, h2, h3, h4, bits, r, i = 0, enc = "";
    if (!data) { return data; }
    do {
        o1 = data[i++];
        o2 = data[i++];
        o3 = data[i++];
        bits = o1 << 16 | o2 << 8 | o3;
        h1 = bits >> 18 & 0x3f;
        h2 = bits >> 12 & 0x3f;
        h3 = bits >> 6 & 0x3f;
        h4 = bits & 0x3f;
        enc += b64_table.charAt(h1) + b64_table.charAt(h2) + b64_table.charAt(h3) + b64_table.charAt(h4);
    } while (i < data.length);
    r = data.length % 3;
    return (r ? enc.slice(0, r - 3) : enc) + "===".slice(r || 3);
}

function b64_decode(data) {
    var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, result = [];
    if (!data) { return data; }
    data += "";
    do {
        h1 = b64_table.indexOf(data.charAt(i++));
        h2 = b64_table.indexOf(data.charAt(i++));
        h3 = b64_table.indexOf(data.charAt(i++));
        h4 = b64_table.indexOf(data.charAt(i++));
        bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;
        o1 = bits >> 16 & 0xff;
        o2 = bits >> 8 & 0xff;
        o3 = bits & 0xff;
        result.push(o1);
        if (h3 !== 64) {
            result.push(o2);
            if (h4 !== 64) {
                result.push(o3);
            }
        }
    } while (i < data.length);
    return result;
}

function keyCharAt(key, i) {
    return key.charCodeAt( Math.floor(i % key.length) );
}

function xor_encrypt(key, data) {
    return _.map(data, function(c, i) {
        return c.charCodeAt(0) ^ keyCharAt(key, i);
    });
}

function xor_decrypt(key, data) {
    return _.map(data, function(c, i) {
        return String.fromCharCode( c ^ keyCharAt(key, i) );
    }).join("");
}


function formSaveHandler() {
    if (!confirm("Save form data?")) {
        return;
    }
    
    var pass = prompt("Password to save card data (empty for no)", "");
    
    //gather data
    var data={
        firstName: $('input[name=firstName]').val(),
        lastName: $('input[name=lastName]').val(),
        addressStreet: $('input[name=addressStreet]').val(),
        addressPostal: $('input[name=addressPc]').val(),
        addressCity: $('input[name=addressCity]').val(),
        phone: $('input[name=phonePrivate]').val(),
        email: $('input[name=email]').val(),
        salutation:  $('select[name=salutation]').find(":selected").val(),
        dat0: $('select[name=olt_id_ccard_valid_month]').find(":selected").val(),
        dat1: $('select[name=olt_id_ccard_valid_year]').find(":selected").val(),
        dat2: $('select[name=pay_card_valid_month]').find(":selected").val(),
        dat3: $('select[name=pay_card_valid_year]').find(":selected").val(),
        dat4: $('select[name=pay_card_type]').find(":selected").val()
    };
    
    if(pass) {
        data=$.extend(data, {
            dat5: XORCipher.encode(pass, $('input[name=olt_id_ccard]').val()),
            dat6: XORCipher.encode(pass, $('input[name=pay_card_number]').val()),
            dat7: XORCipher.encode(pass, $('input[name=pay_card_vn]').val())
        });
    }
    
    var rawdata=JSON.stringify(data);
    GM_setValue(formSaveName,JSON.stringify(rawdata));
    if(DEBUG) {
        alert('saved: '+rawdata);
    }
}

$(document).ready(function() {
    //install save handler
    $(document).on('submit','form#form_payment',formSaveHandler);    
    
    //try to load data
    rawdata=GM_getValue(formSaveName);    
    if(DEBUG) {
        alert('loaded: '+rawdata);
    }
    
    if(rawdata) {
        if (!confirm("Load form data?")) {
            if(confirm("Delete form data?")) {
                GM_deleteValue(formSaveName);
            }
            return;
        }        
        
        data=JSON.parse(rawdata);
        
        //text fields
        $('input[name=firstName]').val(data['firstName']);
        $('input[name=lastName]').val(data['lastName']);
        $('input[name=addressStreet]').val(data['addressStreet']);
        $('input[name=addressPc]').val(data['addressPostal']);
        $('input[name=addressCity]').val(data['addressCity']);
        $('input[name=phonePrivate]').val(data['phone']);
        $('input[name=email]').val(data['email']);
        $('input[name=emailSecond]').val(data['email']);
        
        //drop downs
        $("select[name=salutation] option[value='"+data['salutation']+"']").attr('selected',true);
        exec(function() {
            setDropDown('salutation',true);
        });

        $("select[name=olt_id_ccard_valid_month] option[value='"+data['dat0']+"']").attr('selected',true);
        exec(function() {
            setDropDown('olt_id_ccard_valid_month',true);
        });
        
        $("select[name=olt_id_ccard_valid_year] option[value='"+data['dat1']+"']").attr('selected',true);
        exec(function() {
            setDropDown('olt_id_ccard_valid_year',true);
        });    
        
        $("select[name=pay_card_valid_month] option[value='"+data['dat2']+"']").attr('selected',true);
        exec(function() {
            setDropDown('pay_card_valid_month',true);
        });
        
        $("select[name=pay_card_valid_year] option[value='"+data['dat3']+"']").attr('selected',true);
        exec(function() {
            setDropDown('pay_card_valid_year',true);
        });
        
        $("select[name=pay_card_type] option[value='"+data['dat4']+"']").attr('selected',true);
        exec(function() {
            setDropDown('pay_card_type',true);
        });    

        if(data['dat5']) {
            var pass = prompt("Password to load card data (empty for no)", "");
            
            if(pass) {
                $('input[name=olt_id_ccard]').val(XORCipher.decode(pass, data['dat5']));
                $('input[name=pay_card_number]').val(XORCipher.decode(pass, data['dat6']));
                $('input[name=pay_card_vn]').val(XORCipher.decode(pass, data['dat7']));
            }
        }
    }
    
});
