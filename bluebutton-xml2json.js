(function() {

    var bbx2j = {};

    //Utilities and functions
    bbx2j.leTrim = function(str) {
      return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    };

    bbx2j.camelCasifyCode = function(obj) {
      retObj = {
        name : obj.displayname,
        code : obj.code,
        codeSystem : obj.codesystem,
        codeSystemName : obj.codesystemname || ''
      };

      return retObj;
    };

    bbx2j.camelCasify = function(str) {
      return str.replace(/\s\S/g, function(a) { return a.toUpperCase(); }).replace(/\s/g, '');
    };

    bbx2j.xmlToJson = function(xml) {
      var obj = {};
      if (typeof xml == "undefined") return obj;
      if (xml.nodeType == 1) {
        if (xml.attributes.length > 0) {
          for (var j = 0; j < xml.attributes.length; j++) {
            var attribute = xml.attributes.item(j);
            obj[attribute.nodeName] = bbx2j.leTrim(attribute.nodeValue);
          }
        }
      } else if (xml.nodeType == 3) {
        obj = xml.nodeValue;
      }

      if (xml.hasChildNodes()) {
        for (var i = 0; i < xml.childNodes.length; i++) {
          var item = xml.childNodes.item(i);
          var nodeName = item.nodeName;
          if ('#text' === nodeName) {
            //single textNode or next sibling has a different name
            if ((null === xml.nextSibling) || (xml.localName !== xml.nextSibling.localName)) {
              content = bbx2j.leTrim(xml.textContent);

            //we have a sibling with the same name
            } else if (xml.localName === xml.nextSibling.localName) {
              //if it is the first node of its parents childNodes, send it back as an array
              content = (xml.parentElement.childNodes[0] === xml) ? [xml.textContent] : bbx2j.leTrim(xml.textContent);
            }
            return content;
          } else {
            if (typeof (obj[nodeName]) == "undefined") {
              obj[nodeName.toLowerCase()] = bbx2j.xmlToJson(item);
            } else {
              if (typeof (obj[nodeName].push) == "undefined") {
                var old = obj[nodeName.toLowerCase()];
                obj[nodeName.toLowerCase()] = [];
                obj[nodeName.toLowerCase()].push(old);
              }
              obj[nodeName.toLowerCase()].push(bbx2j.xmlToJson(item));
            }
          }
        }
      }
      return obj;
    };

    bbx2j.convert = function(xmlString) {

      var friendlyJson = {};

      //strip the tabs, line breaks, and extra spaces
      xmlString = xmlString.replace(/([\t\r\n])/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ');

      //jQuery-ize it into an xml/dom object
      var domified = $(xmlString);

      // PATIENT INFO
      var patientObj = domified.find('recordtarget > patientrole');
      var demoObj = bbx2j.xmlToJson(patientObj.children('patient')[0]);
      var addrObj = bbx2j.xmlToJson(patientObj.children('addr')[0]);

      var demographics = {
        firstName: demoObj.name.given,
        lastName: demoObj.name.family,
        gender: demoObj.administrativegendercode.displayname,
        birthTime: demoObj.birthtime.value
      };

      var address = {
        street : addrObj.streetaddressline,
        city : addrObj.city,
        state : addrObj.state,
        country : addrObj.country,
        zipCode : addrObj.postalcode
      };

      friendlyJson.patient = { demographics : demographics, address : address };

      // ALLERGIES

      var allergObs = domified.find("templateId[root='2.16.840.1.113883.10.20.22.4.7']").parent();
      friendlyJson.allergies = [];
      allergObs.each(function(){
        var allergy = {};
        allergy.substance = bbx2j.camelCasifyCode(bbx2j.xmlToJson($(this).find('participant > participantrole > playingentity > code')[0]));

        var objs = $(this).find('entryrelationship > observation');
        objs.each(function(){
          var tehCodez = bbx2j.xmlToJson($(this).find('code')[0]);
          var vals = bbx2j.xmlToJson($(this).find('value')[0]);
          var propName;
          if (typeof tehCodez.displayname !== "undefined") {
            if (tehCodez.nullflavor) {
              propName = 'reaction';
            } else {
              propName = tehCodez.displayname.toLowerCase().split(" ")[0];
            }
            allergy[propName] = bbx2j.camelCasifyCode(vals);
          } else {
            if (typeof allergy.otherCodes == "undefined") allergy.otherCodes = [];
            allergy.otherCodes.push(bbx2j.camelCasifyCode(vals));
          }
        });
        friendlyJson.allergies.push(allergy);
      });

      // MEDICATIONS

      var medObs = domified.find("templateId[root='2.16.840.1.113883.10.20.22.4.16']").parent();
      friendlyJson.medications = [];
      medObs.each(function(){
        var med = {};
        med.product = bbx2j.camelCasifyCode(bbx2j.xmlToJson($(this).find('consumable > manufacturedProduct > manufacturedMaterial > code > translation')[0]));
        med.drugVehicle = bbx2j.camelCasifyCode(bbx2j.xmlToJson($(this).find('participant > participantrole > playingentity > code')[0]));
        med.indication = bbx2j.camelCasifyCode(bbx2j.xmlToJson($(this).find('entryrelationship > observation > code')[0]));
        med.instructions = $(this).find('participant > participantRole > code[displayname=instruction]').siblings('text').text();
        med.date = $(this).children('effectivetime').children('low').attr('value');
        friendlyJson.medications.push(med);
      });

      // IMMUNIZATIONS

      var immObs = domified.find("templateId[root='2.16.840.1.113883.10.20.22.4.52']").parent();
      friendlyJson.immunizations = [];
      immObs.each(function(){
        var imm = {};
        imm.status = $(this).children('statuscode').attr('code');
        imm.product = bbx2j.camelCasifyCode(bbx2j.xmlToJson($(this).find('consumable > manufacturedProduct > manufacturedMaterial > code')[0]));
        imm.instructions = $(this).find('entryrelationship > act > text').text();
        imm.date = $(this).children('effectivetime').attr('value');
        friendlyJson.immunizations.push(imm);
      });

      // PROBLEMS

      var probObjs = domified.find("templateId[root='2.16.840.1.113883.10.20.22.4.4']").parent();
      friendlyJson.problems = [];
      probObjs.each(function(){
        var prob = {};
        var objs = $(this).find('entryrelationship > observation');
        prob.complaint = bbx2j.camelCasifyCode(bbx2j.xmlToJson(objs.find("code[displayname='Complaint']").siblings('value')[0]));
        prob.status = bbx2j.camelCasifyCode(bbx2j.xmlToJson(objs.find("code[displayname='Status']").siblings('value')[0]));
        prob.onsetAge = objs.find("code[displayname='Age At Onset']").siblings('value').attr('value');
        prob.date = $(this).children('effectivetime').children('low').attr('value');
        friendlyJson.problems.push(prob);
      });

      // PROCEDURES

      var procObjs = domified.find("templateId[root='2.16.840.1.113883.10.20.22.4.14']").parent();
      friendlyJson.procedures = [];
      procObjs.each(function(){
        var proc = {};
        proc.procedure = bbx2j.camelCasifyCode(bbx2j.xmlToJson($(this).find("code")[0]));
        proc.targetSite = bbx2j.camelCasifyCode(bbx2j.xmlToJson($(this).find("targetsitecode")[0]));
        friendlyJson.procedures.push(proc);
      });

      // ENCOUNTERS

      var encObjs = domified.find("templateId[root='2.16.840.1.113883.10.20.22.4.49']").parent();
      friendlyJson.encounters = [];
      encObjs.each(function(){
        var enc = {};
        enc.activity = bbx2j.camelCasifyCode(bbx2j.xmlToJson($(this).find("code")[0]));
        friendlyJson.encounters.push(enc);
      });

      // VITAL SIGNS

      var vitalsSec = domified.find("templateId[root='2.16.840.1.113883.10.20.22.2.4.1']").siblings('entry').children('organizer');
      var vitals = [];

      vitalsSec.each(function(){
        var v = {};
        v.date = $(this).find("effectivetime").attr('value');
        var objs = $(this).find('component > observation');
        objs.each(function(){
          var propName = bbx2j.camelCasify($(this).find('code').attr('displayname').toLowerCase().split("-")[0]);
          var valNode = $(this).find('value');
          v[propName] = valNode.attr('value') + " " + valNode.attr('unit');
        });
        vitals.push(v);
      });

      friendlyJson.vitalSigns = vitals;


      return friendlyJson;
    };

  return window.blueButtonXml2Json = bbx2j;

})();
