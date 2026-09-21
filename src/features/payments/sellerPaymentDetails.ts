export type SellerPaymentDetails = {
    name: string
    methods: Record<string, { number: string }>
    qrCode: string
}

const SELLER_DETAILS: Record<string, SellerPaymentDetails> = {
    "Maria Santos": {
        name: "Maria Santos",
        methods: {
            GCash: { number: "0917 •••• 8821" },
            Maya: { number: "0917 •••• 5543" },
            "Bank Transfer": { number: "BDO •••• 4421" },
        },
        qrCode: "MARIA-8821",
    },
    "Ana Reyes": {
        name: "Ana Reyes",
        methods: {
            GCash: { number: "0918 •••• 3142" },
            Maya: { number: "0918 •••• 7740" },
            "Bank Transfer": { number: "BPI •••• 1908" },
        },
        qrCode: "ANA-3142",
    },
    "Paolo Garcia": {
        name: "Paolo Garcia",
        methods: {
            GCash: { number: "0919 •••• 6205" },
            Maya: { number: "0919 •••• 4811" },
            "Bank Transfer": { number: "BDO •••• 7364" },
        },
        qrCode: "PAOLO-6205",
    },
}

export function getSellerPaymentDetails(seller: string): SellerPaymentDetails {
    return (
        SELLER_DETAILS[seller] ?? {
            name: seller,
            methods: {
                GCash: { number: "09XX •••• XXXX" },
                Maya: { number: "09XX •••• XXXX" },
                "Bank Transfer": { number: "Bank account on file" },
            },
            qrCode: `${seller.toUpperCase().replace(/[^A-Z0-9]/g, "-")}-QR`,
        }
    )
}