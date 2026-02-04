import e, { Response, Request } from "express";
import { Logger } from "../utils/Logger";
import axios, { all } from 'axios';

let descriptionLang: string
let codesFound: {
    system: string, 
    ID: string,
    display: string 
    synonyms?: {
        system: string,
        ID: string,
        display: string
    }
}[] = []

const jsdom = require("jsdom");
let JSDOM;

const snomedEndpointList = [
    'codes'
]

const getLeaflet = (epi: any) => {
    const resource = epi?.entry?.[0]?.resource
    if (!resource?.section || !Array.isArray(resource.section) || resource.section.length === 0) {
        throw new Error('Invalid ePI structure: missing or empty section array')
    }
    const leafletSectionList = resource.section[0]?.section
    if (!leafletSectionList) {
        throw new Error('Invalid ePI structure: missing Package Leaflet section')
    }
    return leafletSectionList
}

const getSnomedCodes = async (terminologyType: string): Promise<{ success: boolean, data: any[], statusCode?: number }> => {
    try {
        if (!process.env.TERM_SERVER_URL) {
            throw new Error('TERM_SERVER_URL environment variable is not set')
        }
        const response = await axios.get(`${process.env.TERM_SERVER_URL}/${terminologyType}/all`)
        return { success: true, data: response.data }
    } catch (error: any) {
        const statusCode = error.response?.status
        const errorMsg = error.response?.status === 503 
            ? 'Terminology server unavailable (503)'
            : error.code === 'ECONNREFUSED'
            ? 'Terminology server connection refused'
            : `Failed to fetch terminology codes: ${error.message || error}`
        
        Logger.logError('preprocessing.ts', 'getSnomedCodes', () => `${errorMsg} from ${process.env.TERM_SERVER_URL}/${terminologyType}/all`)
        return { success: false, data: [], statusCode }
    }
}

function annotationProcess(divString: string, code: object, JSDOM: any) {
    let dom = new JSDOM(divString);
    let document = dom.window.document;
    Logger.logDebug('preprocessing.ts', 'annotationProcess', () => `Divstring rendered: ${document.documentElement.outerHTML}`)
    let leaflet = document.querySelectorAll('div');
    recursiveTreeWalker(leaflet, code, document);
    let response = document.documentElement.outerHTML;
    if (document.getElementsByTagName("html").length > 0) {
        response = document.getElementsByTagName("html")[0].innerHTML;
    }
    if (document.getElementsByTagName("head").length > 0) {
        document.getElementsByTagName("head")[0].remove();
    }
    if (document.getElementsByTagName("body").length > 0) {
        response = document.getElementsByTagName("body")[0].innerHTML;
    } else {
        Logger.logDebug('preprocessing.ts', 'annotationProcess', () => `Response: ${document.documentElement.innerHTML}`)
        response = document.documentElement.innerHTML;
    }
    Logger.logDebug('preprocessing.ts', 'annotationProcess', () => `Response: ${response}`)
    return response;
}

function recursiveTreeWalker(nodeList: any, code: any, document: any) {
    for (let i = 0; i < nodeList.length; i++) {
        if (nodeList.item(i).childNodes.length == 1 && nodeList.item(i).childNodes[0].nodeName == '#text') {
            const nodeLC = nodeList.item(i).childNodes[0].textContent.toLowerCase()
            Logger.logDebug('preprocessing.ts', 'recursiveTreeWalker', () => `Node in lowercase: ${nodeLC}`)
            Logger.logDebug('preprocessing.ts', 'recursiveTreeWalker', () => `Code in lowercase: ${code[descriptionLang].toLowerCase()}`)
            Logger.logDebug('preprocessing.ts', 'recursiveTreeWalker', () => `Does this node contain the code? ${nodeLC.includes(code[descriptionLang].toLowerCase())}`)
            if (nodeList.item(i).childNodes[0].textContent.toLowerCase().includes(code[descriptionLang].toLowerCase())) {
                const span = document.createElement('span');
                span.className = code["code"];
                if (code["synonyms"] != undefined) {
                    const synonym = code["synonyms"];
                    Logger.logDebug('preprocessing.ts', 'recursiveTreeWalker', () => `Added synonym ${synonym["code"]} to ${code["code"]}`)
                    span.className = span.className + " " + synonym["code"];
                }
                if (nodeList.item(i).className != "" && nodeList.item(i).className != null && nodeList.item(i).className != undefined) {
                    span.className = nodeList.item(i).className + " " + span.className;
                }
                nodeList.item(i).className = "";
                span.textContent = nodeList.item(i).childNodes[0].textContent;
                nodeList.item(i).childNodes[0].textContent = '';
                nodeList.item(i).parentNode.replaceChild(span, nodeList.item(i));
            } else {
                recursiveTreeWalker(nodeList.item(i).childNodes, code, document);
            }
        } else {
            recursiveTreeWalker(nodeList.item(i).childNodes, code, document);
        }
    }
}

const addSemmanticAnnotation = (leafletSectionList: any[], snomedCodes: any[], JSDOM: any) => {
    leafletSectionList.forEach((section) => {        if (!section?.text?.div) {
            Logger.logWarn('preprocessing.ts', 'addSemmanticAnnotation', 'Section missing text.div field, skipping')
            if (section?.section) {
                addSemmanticAnnotation(section.section, snomedCodes, JSDOM)
            }
            return
        }
                snomedCodes.forEach((code) => {
            const divString: string = section['text']['div']
            if (section.section != undefined) {
                addSemmanticAnnotation(section.section, snomedCodes, JSDOM)
            }
                if (code[descriptionLang] != undefined && code[descriptionLang] != null && code[descriptionLang] != "") {
                const divStringLC = divString.toLowerCase();
                Logger.logDebug('preprocessing.ts', 'addSemmanticAnnotation', () => `Now using this divstring: ${divString}`)
                Logger.logDebug('preprocessing.ts', 'addSemmanticAnnotation', () => `Now using this divstring in lowercase: ${divStringLC}`)
                Logger.logDebug('preprocessing.ts', 'addSemmanticAnnotation', () => `Description: ${code[descriptionLang]}`)
                Logger.logDebug('preprocessing.ts', 'addSemmanticAnnotation', () => `Does this code match the divstring? ${divStringLC.includes(code[descriptionLang].toLowerCase())}`)
                if (divStringLC.includes(code[descriptionLang].toLowerCase())) {
                    let codeObject;
                    if (code['synonyms'] != undefined) {
                        codeObject = {
                            "ID": code["code"],
                            "display": code[descriptionLang],
                            "system": code["codesystem"],
                            "synonyms": {
                                "ID": code["synonyms"]["code"],
                                "display": code["synonyms"][descriptionLang],
                                "system": code["synonyms"]["codesystem"]
                            }
                        }
                    } else {
                        codeObject = {
                            "ID": code["code"],
                            "display": code[descriptionLang],
                            "system": code["codesystem"]
                        }
                    }
                    codesFound.push(codeObject)
                    section['text']['div'] = annotationProcess(divString, code, JSDOM)
                }
            }
        })
    })
    return leafletSectionList
}

const codeToExtension = (code: { ID: string, display: string, system: string }) => {
    return [
        {
            "url": "elementClass",
            "valueString": code.ID
        },
        {
            "url": "concept",
            "valueCodeableReference": {
                "concept": {
                    "coding": [
                        {
                            "system": code.system,
                            "code": code.ID,
                            "display": code.display
                        }
                    ]
                }
            }
        }
    ]
}

export const preprocess = async (req: Request, res: Response) => {
    JSDOM = jsdom.JSDOM;
    let epi = req.body;
    codesFound = []
    
    // Validate ePI structure
    if (!epi || !epi.entry || !Array.isArray(epi.entry) || epi.entry.length === 0) {
        Logger.logError('preprocessing.ts', 'preprocess', 'Invalid ePI structure: missing entry array')
        res.status(400).send('Bad Payload: Invalid ePI structure')
        return
    }
    
    const resource = epi.entry[0]?.resource
    if (!resource) {
        Logger.logError('preprocessing.ts', 'preprocess', 'Invalid ePI structure: missing resource')
        res.status(400).send('Bad Payload: Invalid ePI resource structure')
        return
    }
    
    if (!resource.language) {
        Logger.logError('preprocessing.ts', 'preprocess', 'Invalid ePI structure: missing language')
        res.status(400).send('Bad Payload: Missing language field')
        return
    }
    
    Logger.logInfo('preprocessing.ts', 'preprocess', () => `Received ePI with Length: ${JSON.stringify(epi).length}`)
    Logger.logInfo('preprocessing.ts', 'preprocess', `queried /preprocess function with epi ID: ${JSON.stringify(epi['id'])}`)
    Logger.logDebug('preprocessing.ts', 'preprocess', () => `Language: ${resource.language.toLowerCase()}`)

    descriptionLang = `descr_${resource.language.toLowerCase()}`

    let leafletSectionList
    let snomedCodes: any[] = []
    let terminologyServerFailed = false
    
    // Try to fetch terminology codes, but continue gracefully if it fails
    for (let terminologyType of snomedEndpointList) {
        const result = await getSnomedCodes(terminologyType)
        if (result.success) {
            snomedCodes = snomedCodes.concat(result.data)
        } else {
            terminologyServerFailed = true
            Logger.logWarn('preprocessing.ts', 'preprocess', `Continuing without terminology codes from ${terminologyType} endpoint`)
        }
    }
    
    if (terminologyServerFailed && snomedCodes.length === 0) {
        Logger.logWarn('preprocessing.ts', 'preprocess', 'All terminology endpoints failed - returning ePI without annotations')
    }

    try {
        leafletSectionList = getLeaflet(epi)
    } catch (error) {
        res.status(400).send('Bad Payload')
        return
    }
    let annotatedSectionList
    try {
        annotatedSectionList = addSemmanticAnnotation(leafletSectionList, snomedCodes, JSDOM)
    } catch (error) {
        res.status(500).send('Preprocessor error')
        return
    }
    epi['entry'][0]['resource']['extension'] = [];
    for (let code of codesFound) {
        if (code.synonyms != undefined) {
            if (!codesFound.some((e) => e.ID == code.synonyms?.ID)) {
                codesFound.push(code.synonyms)
            }
        }
    }
    for (let code of codesFound) {
        let codeSystemUrl;
        switch (code.system) {
            case "snomed":
                codeSystemUrl = "http://snomed.info/sct"
                break
            case "icpc-2":
                codeSystemUrl = "placeholder"
                break
            case "gravitate":
                codeSystemUrl = "https://www.gravitatehealth.eu/"
                break
            default:
                codeSystemUrl = code.system
                break
        }
        const codeList: [] = epi['entry'][0]['resource']['extension']
        if (!codeList.some((e: any) => { 
            if (e['valueCodeableConcept'] == undefined) {
                return false
            } else {
                return e['valueCodeableConcept']['concept']['coding'][0]['code'] == code.ID && e['valueCodeableConcept']['concept']['coding'][0]['display'] == code.display
            }
        })) {
            epi['entry'][0]['resource']['extension'].push(
                {   
                    "url": "https://hl7.eu/fhir/ig/gravitate-health/StructureDefinition/HtmlElementLink",
                    "extension": codeToExtension({ID: code.ID, display: code.display, system: codeSystemUrl })
                });
        }
    }
    epi['entry'][0]['resource']['section'][0]['section'] = annotatedSectionList;
    if (epi["entry"][0]["resource"]["category"][0]["coding"][0]["code"] == "R") {
        epi["entry"][0]["resource"]["category"][0]["coding"][0] = {
            "system": epi["entry"][0]["resource"]["category"][0]["coding"][0]["system"],
            "code": "P",
            "display": "Preprocessed"
        };
    }
    Logger.logInfo('preprocessing.ts', 'preprocess', () => `Returning ePI with Length: ${JSON.stringify(epi).length}`);
    res.status(200).send(epi);
    return
};
