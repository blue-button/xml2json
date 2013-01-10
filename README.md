xml2json
========

A utility for converting C-CDA XML file to a simplified JavaScript object. Requires jQuery.

### USAGE
First, make sure jQuery is loaded. Then load the x2j script:

`<script src="bluebutton-xml2json.js"></script>`

This puts a `blueButtonXml2Json` object on the `window`. Simply pass a CCDA XML string to:

`var bb = blueButtonXml2Json.convert(xmlString)`

and you'll get back a simplified version of the data as a plain JavaScript object.
