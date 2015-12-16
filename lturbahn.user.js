// ==UserScript==
// @name			L'TUR Bahn Form Saver
// @description		Saves entered form data on bahn.ltur.com via
//					GM_saveValue and restores it upon next page visit,
//					optionally including XOR encrypted credit card data
// @version			0.2
// @namespace		http://fxlabs.com/ltur
// @include			http://www.ltur.com/de/bahn.html
// @include			https://bahn.ltur.com/ltb/booking*
// @exclude			https://bahn.ltur.com/ltb/booking/confimation*
// @grant 			GM_getValue
// @grant	  		GM_setValue
// @grant	  		GM_addStyle
// @require			http://code.jquery.com/jquery-latest.min.js
// @require			http://underscorejs.org/underscore-min.js
// @downloadURL		https://github.com/exilef/userscripts/raw/master/lturbahn.user.js
// @updateURL		https://github.com/exilef/userscripts/raw/master/lturbahn.user.js
// ==/UserScript==

var formSaveName = 'LTURForm';
var tripsSaveName = 'LTURTrips';
var DEBUG = false;
var url = $(location).attr('href');

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

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
        firstName: $('input[id=firstName]').val(),
        lastName: $('input[id=lastName]').val(),
        addressStreet: $('input[id=addressStreet]').val(),
        addressPostal: $('input[name=addressPc]').val(),
        addressCity: $('input[name=addressCity]').val(),
        phone: $('input[id=phonePrivate]').val(),
        email: $('input[id=email]').val(),
        salutation:  $('select[id=salutation]').find(":selected").val(),
        dat0: $('select[id=olt_id_ccard_valid_month]').find(":selected").val(),
        dat1: $('select[id=olt_id_ccard_valid_year]').find(":selected").val(),
        dat2: $('select[id=pay_card_valid_month]').find(":selected").val(),
        dat3: $('select[id=pay_card_valid_year]').find(":selected").val(),
        dat4: $('select[id=pay_card_type]').find(":selected").val(),
        accBonusCard:  $('input[id=accBonusCard]').is(':checked'),
        bonus_card_number:  $('input[id=bonus_card_number]').val()
    };
    
    if(pass) {
        data=$.extend(data, {
            dat5: XORCipher.encode(pass, $('input[id=olt_id_ccard]').val()),
            dat6: XORCipher.encode(pass, $('input[id=pay_card_number]').val()),
            dat7: XORCipher.encode(pass, $('input[id=pay_card_vn]').val()),
            bonus_card_number: XORCipher.encode(pass, $('input[id=bonus_card_number]').val())
        });
    }
    
    var rawdata=JSON.stringify(data);
    GM_setValue(formSaveName,rawdata);
    if(DEBUG) {
        alert('saved: '+rawdata);
    }
}


var toType = function(obj) {
  return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
}

if(url.startsWith('http://www.ltur.com/de/bahn.html')) {
    
    $(document).ready(function() {
        var buttons = '';
        var data = [];
        var rawdata=GM_getValue(tripsSaveName);    
        //alert('data: ' + rawdata);
        if(rawdata.length > 1) {
            data=JSON.parse(rawdata);
            data.forEach(function (trip, i) {
                buttons += '<input id="trip' + i + '" type="button" value="' + trip[0] + ' -> ' + trip[1] +'" /><input id="trip_delete' + i + '" type="button" value="X" /><br/>';
            });
        }
        var buttonElems = document.getElementsByTagName('body');
        buttonElems[0].innerHTML += buttons;
        buttonElems[0].innerHTML += '<input id="trip_add" type="button" value="+" />';
        buttonElems[0].innerHTML += '<input id="origin_dest" type="button" value="<->" />';
        document.getElementById('trip_add').addEventListener('click',function() { addTrip(); }, true);
        document.getElementById('origin_dest').addEventListener('click',function() { exchangeOriginDest(); }, true);
        data.forEach(function (trip, i) {
            document.getElementById('trip' + i).addEventListener('click',function() { loadTrip(trip); }, true);
            document.getElementById('trip_delete' + i).addEventListener('click',function() { deleteTrip(i); }, true);
        });
    });
}

function loadTrip(trip) {
    //alert('load: ' + trip);
    var f = trip[0];
    var t = trip[1];
    var bc = trip[2];

    //alert(f + ' -> ' + t + ', ' + bc);
    
    $('input[id=from]').val(f);
    $('input[id=to_spar]').val(t);
    if(bc) {
        $("select[id=bcAdult_1_BC_spar_topz] option[value='"+ bc + "']").attr('selected', true);
        exec(function() {
            setDropDown('bcAdult_1_BC_spar_topz',true);
        });     
    }
}

function exchangeOriginDest() {
    var f = $('input[id=from]').val();
    var t = $('input[id=to_spar]').val();
    $('input[id=from]').val(t);
    $('input[id=to_spar]').val(f);
}

function addTrip() {
    var f = $('input[id=from]').val();
    var t = $('input[id=to_spar]').val();
    var bc = $('select[id=bcAdult_1_BC_spar_topz]').find(":selected").val();
    
    if(!f) {
        alert('Empty origin!');
        return;
    }
    if(!t) {
        alert('Empty destination!');
        return;
    }

    if (!confirm("Add new trip " + f + " -> " + t + "?")) {
        return;
    }

    var data = [];
    var rawdata=GM_getValue(tripsSaveName);    
    if(rawdata.length > 1) {
        data=JSON.parse(rawdata);
    }
    
    data.push([f, t, bc]);
    alert(JSON.stringify(data))
    GM_setValue(tripsSaveName,JSON.stringify(data));
    location.reload();
}

function deleteTrip(t) {
    var data = [];
    var rawdata=GM_getValue(tripsSaveName);    
    if(rawdata.length > 1) {
        data=JSON.parse(rawdata);
    }
    
    i = parseInt(t);
    if(data.length <= i) {
        alert('Invalid trip! ' + i + ' ' + data.length);
        return;
    }

    var trip = data[i];
    
    if (!confirm("Delete trip " + trip[0] + " -> " + trip[1] + "?")) {
        return;
    }
    
    data.remove(i);
    GM_setValue(tripsSaveName,JSON.stringify(data));
    location.reload();
}               
               


if(url.startsWith('https://bahn.ltur.com/ltb/booking/')) {
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

            var data=JSON.parse(rawdata);
            if(toType(data) === 'string') {
                data = JSON.parse(data);
            }
            if(DEBUG) {
               alert('loaded (json): '+data);
            }

            //text fields
            $('input[id=firstName]').val(data['firstName']);
            $('input[id=lastName]').val(data['lastName']);
            $('input[id=addressStreet]').val(data['addressStreet']);
            $('input[name=addressPc]').val(data['addressPostal']);
            $('input[name=addressCity]').val(data['addressCity']);
            $('input[id=phonePrivate]').val(data['phone']);
            $('input[id=email]').val(data['email']);
            $('input[id=emailSecond]').val(data['email']);

            //drop downs
            $("select[id=salutation] option[value='"+data['salutation']+"']").attr('selected',true);
            exec(function() {
                setDropDown('salutation',true);
            });

            $("select[id=olt_id_ccard_valid_month] option[value='"+data['dat0']+"']").attr('selected',true);
            exec(function() {
                setDropDown('olt_id_ccard_valid_month',true);
            });

            $("select[id=olt_id_ccard_valid_year] option[value='"+data['dat1']+"']").attr('selected',true);
            exec(function() {
                setDropDown('olt_id_ccard_valid_year',true);
            });    

            $("select[id=pay_card_valid_month] option[value='"+data['dat2']+"']").attr('selected',true);
            exec(function() {
                setDropDown('pay_card_valid_month',true);
            });

            $("select[id=pay_card_valid_year] option[value='"+data['dat3']+"']").attr('selected',true);
            exec(function() {
                setDropDown('pay_card_valid_year',true);
            });

            $("select[id=pay_card_type] option[value='"+data['dat4']+"']").attr('selected',true);
            exec(function() {
                setDropDown('pay_card_type',true);
            });    

            if(data['dat5']) {
                var pass = prompt("Password to load card data (empty for no)", "");

                if(pass) {
                    $('input[id=olt_id_ccard]').val(XORCipher.decode(pass, data['dat5']));
                    $('input[id=pay_card_number]').val(XORCipher.decode(pass, data['dat6']));
                    $('input[id=pay_card_vn]').val(XORCipher.decode(pass, data['dat7']));
                    if(data['accBonusCard']) {
                       if(!$('input[id=accBonusCard]').is(':checked')) {
                          $('input[id=accBonusCard]').click();
                       }
                       $('input[id=bonus_card_number]').val(XORCipher.decode(pass,data['bonus_card_number']));
                    }
                }
            }
        }
    });
}

if(url.startsWith('https://bahn.ltur.com/ltb/bookingcheck/')) {
    $(document).ready(function() {
       if(!$('input[id=accAgb]').is(':checked')) {
         $('input[id=accAgb]').click();
       }
       if(!$('input[id=accMOT]').is(':checked')) {
         $('input[id=accMOT]').click();
       }
    });
}

    
