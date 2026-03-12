export const tools = [
    {
        type: "function",
        name: "check_package",
        description: "Get information about package",
        parameters: {
            type: "object",
            properties: {
                packageid: {
                    type: "string",
                    description: "Package ID",
                },
            },
            required: ["packageid"],
            additionalProperties: false,
        },
        strict: true,
    },
    {
        type: "function",
        name: "redirect_package",
        description: "Redirect package. Tool returns confirmation id",
        parameters: {
            type: "object",
            properties: {
                packageid: {
                    type: "string",
                    description: "Package ID. Format: followed by 8 digits."
                },
                destination: {
                    type: "string",
                    description: "Destination ID",
                },
                code: {
                    type: "string",
                    description: "security code to allow package redirection",
                },
            },
            required: ["packageid", "destination", "code"],
            additionalProperties: false,
        },
        strict: true,
    }
]