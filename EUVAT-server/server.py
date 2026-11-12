import json
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape


SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/"
SERVICE_NS = "urn:ec.europa.eu:taxud:tedb:services:v1:IVatRetrievalService"
TYPES_NS = SERVICE_NS + ":types"
SERVICE_PATH = "/taxation_customs/tedb/ws/"
WSDL_PATH = SERVICE_PATH + "VatRetrievalService.wsdl"
ROOT = Path(__file__).resolve().parent
RATES_FILE = ROOT / "vat-rates.json"

for prefix, namespace in [("soapenv", SOAP_NS), ("service", SERVICE_NS), ("types", TYPES_NS)]:
    ET.register_namespace(prefix, namespace)


def element(parent, name, value=None):
    node = ET.SubElement(parent, f"{{{TYPES_NS}}}{name}")
    if value is not None:
        node.text = str(value)
    return node


def soap_response(country, day, value):
    envelope = ET.Element(f"{{{SOAP_NS}}}Envelope")
    body = ET.SubElement(envelope, f"{{{SOAP_NS}}}Body")
    response = ET.SubElement(body, f"{{{SERVICE_NS}}}retrieveVatRatesRespMsg")
    countries = element(element(response, "additionalInformation"), "countries")
    info = element(countries, "country")
    element(info, "isoCode", country)
    element(info, "cnCodeProvided", "false")
    element(info, "cpaCodeProvided", "false")
    result = element(response, "vatRateResults")
    element(result, "memberState", country)
    element(result, "type", "STANDARD")
    rate = element(result, "rate")
    element(rate, "type", "DEFAULT")
    element(rate, "value", value)
    element(result, "situationOn", day)
    return ET.tostring(envelope, encoding="utf-8", xml_declaration=True)


class VatHandler(BaseHTTPRequestHandler):
    def respond(self, status, payload, content_type="text/xml; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/health":
            return self.respond(200, b"ok", "text/plain")
        if path == WSDL_PATH:
            address = escape("http://" + self.headers["Host"] + SERVICE_PATH, {'"': "&quot;"})
            wsdl = (ROOT / "VatRetrievalService.wsdl").read_text().replace("__SERVICE_URL__", address)
            return self.respond(200, wsdl.encode())
        self.send_error(404)

    def do_POST(self):
        if urlsplit(self.path).path != SERVICE_PATH:
            return self.send_error(404)
        try:
            request = ET.fromstring(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            country = request.findtext(f".//{{{TYPES_NS}}}isoCode")
            day = date.fromisoformat(request.findtext(f".//{{{TYPES_NS}}}situationOn")).isoformat()
            rate = json.loads(RATES_FILE.read_text())[country]
        except (ET.ParseError, ValueError, TypeError, KeyError, OSError) as error:
            envelope = ET.Element(f"{{{SOAP_NS}}}Envelope")
            body = ET.SubElement(envelope, f"{{{SOAP_NS}}}Body")
            fault = ET.SubElement(body, f"{{{SOAP_NS}}}Fault")
            ET.SubElement(fault, "faultcode").text = "soapenv:Server"
            ET.SubElement(fault, "faultstring").text = str(error)
            return self.respond(500, ET.tostring(envelope, encoding="utf-8"))
        self.respond(200, soap_response(country, day, rate))


if __name__ == "__main__":
    with ThreadingHTTPServer(("0.0.0.0", 4202), VatHandler) as server:
        print("EU VAT mock listening on port 4202", flush=True)
        server.serve_forever()
