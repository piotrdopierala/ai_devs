export const tools = [
    {
        type: "function",
        name: "get_suspects_list",
        description: "Get suspects list. name,surname,birthYear",
        parameters: {
            type: "object",
            properties: {},
        },
        strict: true,
    },
    {
        type: "function",
        name: "get_suspect_locations",
        description: "Get list of single suspect location coordinates.",
        parameters: {
            type: "object",
            properties: {
                name: {type: "string", description: "Suspect name"},
                surname: {type: "string", description: "Suspect surname"},
            },
            required: ["name", "surname"],
            additionalProperties: false,
        },
        strict: true,
    },
    {
        type: "function",
        name: "get_powerplant_data",
        description: "Get powerplant data.",
        parameters: {
            type: "object",
            properties: {}
        },
        strict: true,
    },
    {
        type: "function",
        name: "send_results",
        description: "Send final answer with identified person details to the verification endpoint.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Person's first name" },
                surname: { type: "string", description: "Person's surname" },
                accessLevel: { type: "number", description: "Person's access level" },
                powerPlant: { type: "string", description: "Power plant code (PWR + four digits + 2 letters)" },
            },
            required: ["name", "surname", "accessLevel", "powerPlant"],
            additionalProperties: false,
        },
        strict: true,
    },
    {
        type: "function",
        name: "closest_locations_proximity",
        description: "Calculate distance from a given point to each location in a list using the Haversine formula. Returns each location with its distance in km.",
        parameters: {
            type: "object",
            properties: {
                point: {
                    type: "object",
                    description: "Reference point",
                    properties: {
                        latitude: { type: "number" },
                        longitude: { type: "number" },
                    },
                    required: ["latitude", "longitude"],
                    additionalProperties: false,
                },
                locations: {
                    type: "array",
                    description: "List of locations to measure distance to",
                    items: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            latitude: { type: "number" },
                            longitude: { type: "number" },
                        },
                        required: ["name", "latitude", "longitude"],
                        additionalProperties: false,
                    },
                },
            },
            required: ["point", "locations"],
            additionalProperties: false,
        },
        strict: true,
    },
    {
        type: "function",
        name: "get_person_access_level",
        description: "Get powerplant data.",
        parameters: {
            type: "object",
            properties: {
                name: {type: "string", description: "name"},
                surname: {type: "string", description: "surname"},
                birthYear: {type: "number", description: "Year of birth"},
            },
            required: ["name", "surname"],
            strict: true,
        }
    }
];