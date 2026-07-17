"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";

const API     = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.devsimulate.com";

interface CertData {
  id:             string;
  recipientName:  string;
  githubUsername: string;
  campaignName:   string;
  companyName:    string;
  score:          number;
  rank:           number | null;
  category:       string | null;
  issuedAt:       string;
  branding: {
    logoUrl:      string | null;
    primaryColor: string;
    accentColor:  string;
    brandName:    string | null;
  };
}

// ─── Brand SVGs — inlined raw so the exact company artwork is preserved ────────
const LMKR_SVG = `<svg width="100%" height="100%" viewBox="0 0 171 171" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M150.061 6.56H20.8405C12.9539 6.56 6.56055 12.9534 6.56055 20.84V150.06C6.56055 157.947 12.9539 164.34 20.8405 164.34H150.061C157.947 164.34 164.341 157.947 164.341 150.06V20.84C164.341 12.9534 157.947 6.56 150.061 6.56Z" fill="url(#paint0_radial_280_2)"/>
<path d="M126.31 29.52L109.54 62.76L92.4501 29.52H83.5801V82.95H92.4501V47.23L106.26 73.28H112.83L126.31 47.23V82.95H135.18V29.52H126.31Z" fill="#231F20"/>
<path d="M61.6299 90.69L44.5499 114.92V90.69H35.6699V144.13H44.5499V117.64L61.6099 144.13H72.4599L53.9299 116.21L72.4699 90.69H61.6299Z" fill="#231F20"/>
<path d="M100.671 114.71V98H113.821C119.741 98 123.821 101.16 123.821 106.41C123.821 111.66 119.821 114.74 113.821 114.74L100.671 114.71ZM132.671 106.3C132.671 97.22 125.601 90.69 114.511 90.69H91.8008V144.13H100.671V121.61H111.771L124.091 144.13H134.441L121.001 120.49C127.541 118.83 132.641 114 132.641 106.3H132.671Z" fill="#231F20"/>
<path d="M74.2305 116.21C74.2305 113.92 71.3405 112.06 67.7705 112.06C64.2005 112.06 61.3105 113.92 61.3105 116.21C61.3105 118.5 64.2005 120.37 67.7705 120.37C71.3405 120.37 74.2305 118.51 74.2305 116.21Z" fill="#231F20"/>
<path d="M88.4903 140.38C88.4903 138.09 85.6003 136.23 82.0303 136.23C78.4603 136.23 75.5703 138.09 75.5703 140.38C75.5703 142.67 78.4703 144.54 82.0303 144.54C85.5903 144.54 88.4903 142.68 88.4903 140.38Z" fill="#231F20"/>
<path d="M81.3907 128.3C81.3907 126 78.5007 124.14 74.9407 124.14C71.3807 124.14 68.4707 126 68.4707 128.3C68.4707 130.6 71.3707 132.45 74.9407 132.45C78.5107 132.45 81.3907 130.59 81.3907 128.3Z" fill="#231F20"/>
<path d="M88.4891 148.31C84.9291 148.31 82.0391 150.17 82.0391 152.47C82.0391 154.77 84.9291 156.62 88.4891 156.62C92.0491 156.62 94.9991 154.76 94.9991 152.47C94.9991 150.18 92.1091 148.31 88.5391 148.31" fill="#231F20"/>
<path d="M82.0001 96.2C85.5701 96.2 88.4601 94.34 88.4601 92.04C88.4601 89.74 85.6001 87.89 82.0001 87.89C78.4001 87.89 75.5801 89.76 75.5801 92C75.5801 94.24 78.4601 96.2 82.0001 96.2Z" fill="#231F20"/>
<path d="M74.8799 108.28C78.4399 108.28 81.3299 106.42 81.3299 104.13C81.3299 101.84 78.4399 100 74.8799 100C71.3199 100 68.4199 101.85 68.4199 104.15C68.4199 106.45 71.3099 108.3 74.8799 108.3" fill="#231F20"/>
<path d="M44.6005 28.18H35.7305V81.61H72.7905V74.33H44.6005V28.18Z" fill="white"/>
<path d="M126.361 28.18L109.591 61.42L92.5009 28.18H83.6309V81.61H92.5009V45.89L106.311 71.94H112.881L126.361 45.89V81.61H135.221V28.18H126.361Z" fill="white"/>
<path d="M61.6805 89.35L44.6005 113.57V89.35H35.7305V142.79H44.6005V116.3L61.6605 142.79H72.5105L53.9805 114.87L72.5205 89.35H61.6805Z" fill="white"/>
<path d="M100.73 113.37V96.63H113.87C119.79 96.63 123.82 99.79 123.82 105.04C123.82 110.29 119.82 113.37 113.87 113.37H100.73ZM132.73 104.96C132.73 95.88 125.66 89.35 114.57 89.35H91.8496V142.79H100.73V120.27H111.82L124.14 142.79H134.49L121 119.15C127.59 117.49 132.69 112.62 132.69 105L132.73 104.96Z" fill="white"/>
<path d="M74.2794 114.87C74.2794 112.57 71.3894 110.71 67.8194 110.71C64.2494 110.71 61.3594 112.57 61.3594 114.87C61.3594 117.17 64.2594 119.03 67.8194 119.03C71.3794 119.03 74.2794 117.17 74.2794 114.87Z" fill="#E86F24"/>
<path d="M88.5491 139C88.5491 136.71 85.6491 134.85 82.0791 134.85C78.5091 134.85 75.6191 136.71 75.6191 139C75.6191 141.29 78.5191 143.16 82.0791 143.16C85.6391 143.16 88.5491 141.29 88.5491 139Z" fill="#E86F24"/>
<path d="M81.4395 127C81.4395 124.7 78.5495 122.84 74.9895 122.84C71.4295 122.84 68.5195 124.7 68.5195 127C68.5195 129.3 71.4195 131.15 74.9895 131.15C78.5595 131.15 81.4395 129.29 81.4395 127Z" fill="#E86F24"/>
<path d="M88.5398 147C84.9798 147 82.0898 148.86 82.0898 151.16C82.0898 153.46 84.9798 155.3 88.5398 155.3C92.0998 155.3 94.9998 153.42 94.9998 151.13C94.9998 148.84 92.1098 147 88.5398 147Z" fill="#E86F24"/>
<path d="M82.0809 94.86C85.6509 94.86 88.5409 93 88.5409 90.7C88.5409 88.4 85.6509 86.55 82.0809 86.55C78.5109 86.55 75.6309 88.42 75.6309 90.7C75.6309 92.98 78.5209 94.86 82.0809 94.86Z" fill="#E86F24"/>
<path d="M74.9307 106.94C78.5007 106.94 81.3907 105.08 81.3907 102.79C81.3907 100.5 78.5007 98.63 74.9307 98.63C71.3607 98.63 68.4707 100.49 68.4707 102.79C68.4707 105.09 71.3607 106.94 74.9307 106.94Z" fill="#E86F24"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M21.46 7.33H149.46C153.204 7.34055 156.792 8.83264 159.44 11.4802C162.087 14.1278 163.579 17.7157 163.59 21.46V149.46C163.579 153.204 162.087 156.792 159.44 159.44C156.792 162.087 153.204 163.579 149.46 163.59H21.46C17.7123 163.579 14.1214 162.085 11.4732 159.433C8.82502 156.781 7.33527 153.188 7.33 149.44V21.44C7.34582 17.6992 8.84023 14.1164 11.4873 11.4731C14.1343 8.82986 17.7192 7.34053 21.46 7.33ZM19.8 0H151.1C156.346 0.0158264 161.373 2.10697 165.083 5.81677C168.793 9.52656 170.884 14.5536 170.9 19.8V151.1C170.884 156.346 168.793 161.373 165.083 165.083C161.373 168.793 156.346 170.884 151.1 170.9H19.8C14.5536 170.884 9.52656 168.793 5.81677 165.083C2.10697 161.373 0.0158264 156.346 0 151.1L0 19.8C0.0158264 14.5536 2.10697 9.52656 5.81677 5.81677C9.52656 2.10697 14.5536 0.0158264 19.8 0Z" fill="#E7E7E8"/>
<defs>
<radialGradient id="paint0_radial_280_2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(85.4505 85.45) scale(78.89)">
<stop stop-color="#13A8E0"/><stop offset="1" stop-color="#195792"/>
</radialGradient>
</defs>
</svg>`;

const DEVFEST_SVG = `<svg width="100%" height="100%" viewBox="0 0 1000 328" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M958 87.2H197V42.48C197 39.0666 195.644 35.7931 193.23 33.3795C190.817 30.9659 187.543 29.61 184.13 29.61H12.87C9.45666 29.61 6.18313 30.9659 3.76954 33.3795C1.35594 35.7931 0 39.0666 0 42.48L0 315.41C0 318.55 1.24743 321.562 3.46786 323.782C5.68829 326.003 8.69984 327.25 11.84 327.25H958C961.14 327.25 964.152 326.003 966.372 323.782C968.593 321.562 969.84 318.55 969.84 315.41V99C969.829 95.8668 968.577 92.8655 966.358 90.6537C964.139 88.4419 961.133 87.2 958 87.2Z" fill="#19A8E0"/>
<path d="M987.619 57.59H226.559V12.87C226.557 9.45574 225.199 6.18223 222.783 3.76893C220.368 1.35562 217.094 0 213.679 0L42.4794 0C39.066 0 35.7925 1.35594 33.3789 3.76954C30.9653 6.18313 29.6094 9.45666 29.6094 12.87V285.8C29.6094 288.94 30.8568 291.952 33.0772 294.172C35.2977 296.393 38.3092 297.64 41.4494 297.64H987.619C990.76 297.64 993.771 296.393 995.992 294.172C998.212 291.952 999.459 288.94 999.459 285.8V69.43C999.459 67.8752 999.153 66.3355 998.558 64.899C997.963 63.4625 997.091 62.1573 995.992 61.0579C994.892 59.9584 993.587 59.0863 992.15 58.4913C990.714 57.8963 989.174 57.59 987.619 57.59Z" fill="#191919"/>
<path d="M488.391 221.82H515.441V173.81H562.201V151H515.441V122.55H567.311V99.73H488.391V221.82Z" fill="#E86F24"/>
<path d="M612.339 169.76H660.499V146.95H612.339V122.55H665.529V99.73H585.289V221.82H666.359V199.01H612.339V169.76Z" fill="#E86F24"/>
<path d="M712.131 148.22L707.101 143.37V127.39L712.131 122.55H761.611V99.73H698.601L680.051 117.62V153.78L698.601 171.67H734.971L740.001 176.59V194.16L734.971 199.01H683.101V221.82H748.411L767.051 203.94V166.18L748.411 148.22H712.131Z" fill="#E86F24"/>
<path d="M775.381 99.73V122.55H805.481V221.82H832.451V122.55H862.541V99.73H775.381Z" fill="#E86F24"/>
<path d="M164.061 252.02V266.67L167.091 269.71H176.761V265.83H169.301L168.481 265.01V253.68L169.301 252.86H176.761V248.98H167.091L164.061 252.02Z" fill="white"/>
<path d="M192.369 248.85L189.369 251.85V266.78L192.369 269.78H200.939L203.939 266.78V251.88L200.939 248.88L192.369 248.85ZM199.559 265.15L198.719 265.98H194.579L193.759 265.15V253.54L194.579 252.71H198.719L199.559 253.54V265.15Z" fill="white"/>
<path d="M217.279 249V269.73H228.849L231.849 266.73V252L228.849 249H217.279ZM227.459 265L226.629 265.82H221.709V252.82H226.629L227.459 253.64V265Z" fill="white"/>
<path d="M249.61 260.87H257.49V257H249.61V252.86H258.31V248.98H245.18V269.71H258.44V265.83H249.61V260.87Z" fill="white"/>
<path d="M291.101 264.46H286.961V269.71H291.101V264.46Z" fill="white"/>
<path d="M320.119 252.02V266.67L323.159 269.71H332.829V265.83H325.369L324.549 265.01V253.68L325.369 252.86H332.829V248.98H323.159L320.119 252.02Z" fill="white"/>
<path d="M348.439 248.85L345.439 251.85V266.78L348.439 269.78H356.999L359.999 266.78V251.88L356.999 248.88L348.439 248.85ZM355.629 265.15L354.789 265.98H350.649L349.829 265.15V253.54L350.649 252.71H354.789L355.629 253.54V265.15Z" fill="white"/>
<path d="M377.78 248.98H373.35V269.71H385.68V265.83H377.78V248.98Z" fill="white"/>
<path d="M403.141 248.98H398.711V269.71H411.041V265.83H403.141V248.98Z" fill="white"/>
<path d="M429.13 249L423.75 254.39V269.73H428.17V263.79H434.24V269.73H438.67V254.37L433.27 248.98L429.13 249ZM434.24 259.92H428.17V256L431.1 253H431.32L434.24 255.93V259.92Z" fill="white"/>
<path d="M464.14 258.82L466.23 256.71V252L463.23 249H452V269.73H463.49L466.54 266.73V261.48L464.14 259V258.82ZM456.39 252.82H461L461.84 253.64V256.27L461 257.09H456.41L456.39 252.82ZM462.09 264.97L461.26 265.79H456.39V261H461.26L462.09 261.83V264.97Z" fill="white"/>
<path d="M482.471 248.85L479.471 251.85V266.78L482.471 269.78H491.001L494.001 266.78V251.88L491.001 248.88L482.471 248.85ZM489.661 265.15L488.821 265.98H484.681L483.861 265.15V253.54L484.681 252.71H488.821L489.661 253.54V265.15Z" fill="white"/>
<path d="M518.901 261.48L521.291 259.1V252L518.291 249H507.381V269.73H511.811V262.16H513.811L517.121 265.48V269.73H521.411V264.19L518.911 261.71L518.901 261.48ZM516.901 257.48L516.061 258.31H511.841V252.9H516.001L516.841 253.72L516.901 257.48Z" fill="white"/>
<path d="M539.57 249L534.18 254.39V269.73H538.61V263.79H544.68V269.73H549.11V254.37L543.71 248.98L539.57 249ZM544.68 259.92H538.61V256L541.54 253.07H541.75L544.68 256V259.92Z" fill="white"/>
<path d="M560.391 252.86H565.321V269.71H569.731V252.86H574.651V248.98H560.391V252.86Z" fill="white"/>
<path d="M591.391 260.87H599.271V257H591.391V252.86H600.091V248.98H586.971V269.71H600.231V265.83H591.391V260.87Z" fill="white"/>
<path d="M632.88 264.46H628.74V269.71H632.88V264.46Z" fill="white"/>
<path d="M666.66 248.98H662.23V269.7H666.66V248.98Z" fill="white"/>
<path d="M690.781 257.71H690.551L684.721 251.88V248.98H680.301V269.71H684.721V257.63H684.951L690.781 263.46V269.71H695.191V248.98H690.781V257.71Z" fill="white"/>
<path d="M719.31 257.71H719.08L713.25 251.88V248.98H708.83V269.71H713.25V257.63H713.48L719.31 263.46V269.71H723.72V248.98H719.31V257.71Z" fill="white"/>
<path d="M740.07 248.85L737.07 251.85V266.78L740.07 269.78H748.63L751.63 266.78V251.88L748.63 248.88L740.07 248.85ZM747.26 265.15L746.42 265.98H742.28L741.46 265.15V253.54L742.28 252.71H746.42L747.26 253.54V265.15Z" fill="white"/>
<path d="M775.15 263.07L772.23 266.01H772.01L769.08 263.07V248.98H764.66V264.32L770.04 269.71H774.18L779.58 264.32V248.98H775.15V263.07Z" fill="white"/>
<path d="M797.861 249L792.471 254.39V269.73H796.901V263.79H803.001V269.73H807.421V254.37L802.001 249H797.861ZM803.001 259.9H796.901V256L799.831 253.07H800.001L803.001 256V259.9Z" fill="white"/>
<path d="M818.68 252.86H823.61V269.71H828.02V252.86H832.94V248.98H818.68V252.86Z" fill="white"/>
<path d="M849.68 265.83V260.87H857.56V257H849.68V252.86H858.38V248.98H845.26V269.71H858.52V265.83H849.68Z" fill="white"/>
<path d="M165.449 99.73V221.82H236.129L254.679 203.94V117.62L236.129 99.73H165.449ZM227.629 194.16L222.629 199.01H192.499V122.55H222.599L227.599 127.39L227.629 194.16Z" fill="white"/>
<path d="M303.909 169.76H352.069V146.95H303.909V122.55H357.109V99.73H276.869V221.82H357.929V199.01H303.909V169.76Z" fill="white"/>
<path d="M439.16 182.71L421.26 200.04H419.95L402.05 182.71V99.73H375V190.11L407.91 221.82H433.22L466.21 190.11V99.73H439.16V182.71Z" fill="white"/>
<path d="M908.73 132.23H893.87L908.19 118.45V105.41L902.05 99.52H882.86V107.03H897.62L899.27 108.63V115.34L881.75 132.23V139.75H908.73V132.23Z" fill="white"/>
<path d="M936.21 99.25H920.85L914.74 105.15V134.15L920.85 140.04H936.21L942.35 134.15V105.15L936.21 99.25ZM933.43 130.9L931.78 132.52H925.31L923.65 130.9V128.43L933.43 118.98V130.9ZM933.43 110.83L923.65 120.29V108.37L925.31 106.75H931.78L933.43 108.37V110.83Z" fill="white"/>
<path d="M67.17 18.48H58.25V58.72H83.09V51.2H67.17V18.48Z" fill="white"/>
<path d="M117.039 24.11L108.069 32.76H107.629L98.6694 24.11V18.48H89.8594V58.72H98.6694V35.27H99.0994L103.959 39.94V47.45H111.739V39.94L116.569 35.27H117.039V58.72H125.809V18.48H117.039V24.11Z" fill="white"/>
<path d="M153.801 38.39L162.751 29.75V18.48H154.131V27.34L146.331 34.85H142.721V18.48H133.801V58.72H142.721V42.34H146.331L154.671 50.41V58.72H163.321V47.98L153.801 38.81V38.39Z" fill="white"/>
<path d="M179 44H183L189.66 50.44V58.69H198.3V48L193.3 43.18V42.76L198.11 38.15V24.38L192 18.48H170.08V58.71H179V44ZM179 26H187.5L189.19 27.6V34.91L187.5 36.5H179V26Z" fill="white"/>
<path d="M908.73 182.1H893.87L908.19 168.32V155.28L902.05 149.38H882.86V156.9H897.62L899.27 158.5V165.2L881.75 182.1V189.62H908.73V182.1Z" fill="white"/>
<path d="M935.61 189.88L941.72 183.98V168.43L935.61 162.53H927.27L924.09 165.53H923.65V158.41L925.31 156.81H940.07V149.34H920.85L914.74 155.24V184L920.85 189.9L935.61 189.88ZM923.61 176.36L930 170.21H931.11L932.77 171.8V180.8L931.11 182.43H925.27L923.61 180.8V176.36Z" fill="white"/>
<path d="M942.33 205.5H860.07V221.82H942.33V205.5Z" fill="white"/>
<path d="M77.3407 106.79L63.7207 119.84L105.531 162.21L63.7207 204.02L77.3407 217.07L132.581 162.21L77.3407 106.79Z" fill="#195792"/>
</svg>`;

// DevSimulate issuer mark — the terminal ">_" logo.
const DEVSIM_SVG = `<svg width="100%" height="100%" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="ds_issuer_g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop stop-color="#6366F1"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs>
<rect width="40" height="40" rx="10" fill="url(#ds_issuer_g)"/>
<polyline points="15,12.5 25.5,20 15,27.5" fill="none" stroke="#FFFFFF" stroke-width="4.3" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="15" y="30.4" width="11" height="3.4" rx="1.7" fill="#2DD4BF"/>
</svg>`;

export default function CertificatePage() {
  const { id }              = useParams<{ id: string }>();
  const [cert, setCert]       = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    fetch(`${API}/certificates/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setCert(j.data);
        else setError(j.error ?? "Certificate not found");
      })
      .catch((err) => setError(err?.message ?? "Failed to load certificate"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#D0D2D6", fontFamily: "sans-serif", color: "#555" }}>
        Loading…
      </div>
    );
  }

  if (!cert) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", background: "#D0D2D6", fontFamily: "sans-serif", color: "#888" }}>
        <div>{error ?? "Certificate not found."}</div>
        {error && <div style={{ fontSize: "12px", color: "#bbb" }}>ID: {id}</div>}
      </div>
    );
  }

  const certUrl = `${APP_URL}/certificate/${cert.id}`;
  const issued  = format(new Date(cert.issuedAt), "MMMM d, yyyy");
  const year    = new Date(cert.issuedAt).getFullYear();
  const credId  = `DS-${year}-DF-${cert.id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()}`;
  const verifyDisplay = certUrl.replace(/^https?:\/\//, "");

  const linkedInUrl = [
    "https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME",
    `&name=${encodeURIComponent(`LMKR DevFest 2026 — ${cert.campaignName}`)}`,
    `&issueYear=${year}`,
    `&issueMonth=${new Date(cert.issuedAt).getMonth() + 1}`,
    `&certUrl=${encodeURIComponent(certUrl)}`,
    `&certId=${encodeURIComponent(cert.id)}`,
  ].join("");

  function copyLink() {
    navigator.clipboard.writeText(certUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tomorrow:wght@400;500;600;700&display=swap');

        .cert-page { --sidebar-bg:#195792; --main-bg:#E7E7E8; --accent-orange:#E86F24; --accent-blue:#13A8E0;
          --text-primary:#111111; --text-secondary:#195792; --hairline:#C4C9D4;
          min-height:100vh; display:flex; flex-direction:column; align-items:center; gap:26px;
          padding:36px 16px; background:#D0D2D6; font-family:'Tomorrow',sans-serif; }
        .cert-page * { box-sizing:border-box; margin:0; padding:0; }
        .cert-scroll { max-width:100%; overflow-x:auto; }

        .certificate { width:1123px; height:794px; background:var(--main-bg); color:var(--text-primary);
          position:relative; display:flex; box-shadow:0 24px 60px rgba(25,87,146,0.15); overflow:hidden; }

        .rail { width:230px; flex-shrink:0; background:var(--sidebar-bg); color:var(--main-bg);
          padding:44px 30px 36px; display:flex; flex-direction:column; position:relative; }
        .rail-accent { position:absolute; top:0; left:0; width:100%; height:4px; background:var(--accent-orange); }
        .rail-eyebrow { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:#FFF; font-weight:600; }
        .rail-title { font-size:28px; font-weight:700; color:#FFF; margin-top:14px; line-height:1.2; }
        .hosted-section { margin-top:34px; padding-top:22px; border-top:1px solid rgba(19,168,224,0.3); }
        .hosted-label { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:#FFF; font-weight:600; margin-bottom:16px; }
        .lmkr-logo { width:56px; height:56px; }
        .rail-meta { margin-top:auto; font-size:11px; line-height:1.9; color:rgba(231,231,232,0.8); }
        .rail-meta .rail-label { display:block; letter-spacing:0.18em; text-transform:uppercase; font-size:10px; margin-bottom:2px; }
        .rail-meta strong { color:#FFF; font-weight:600; font-size:15px; }

        .main-field { flex:1; padding:48px 56px 40px 52px; display:flex; flex-direction:column; position:relative; min-width:0; }
        .field-header { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; }
        .cert-title { font-size:17px; letter-spacing:0.26em; text-transform:uppercase; color:var(--text-secondary);
          font-weight:700; border-left:3px solid var(--accent-orange); padding:2px 0 2px 12px; line-height:1.3; }
        .devfest-logo { display:flex; justify-content:flex-end; flex-shrink:0; }
        .devfest-logo-inner { height:80px; width:244px; }

        .presentation-block { margin-top:48px; }
        .presented-to { font-size:11px; letter-spacing:0.05em; text-transform:uppercase; color:var(--text-secondary); font-weight:600; }
        .candidate-name { font-size:54px; font-weight:700; line-height:1.05; margin-top:8px; letter-spacing:-0.01em; color:var(--text-primary); }
        .name-rule { width:88px; height:4px; background:var(--accent-orange); margin:16px 0 26px; }
        .category-block { margin-bottom:26px; }
        .category-label { font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:var(--text-secondary); font-weight:600; margin-bottom:6px; }
        .category-value { font-size:20px; font-weight:700; color:var(--accent-orange); letter-spacing:-0.01em; }
        .attainment { font-size:15px; line-height:1.65; color:var(--text-primary); max-width:620px; }
        .accent-bold { color:var(--accent-orange); font-weight:700; }

        .spectrum { margin-top:auto; padding-top:26px; border-top:1px solid var(--hairline); }
        .spectrum-label { font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:var(--text-secondary); margin-bottom:14px; font-weight:600; }
        .dimensions { display:flex; width:100%; }
        .dim { padding-right:18px; } .dim:last-child { padding-right:0; }
        .dim.d40 { width:40%; } .dim.d30 { width:30%; } .dim.d20 { width:20%; } .dim.d10 { width:10%; }
        .bar { height:5px; background:var(--accent-blue); margin-bottom:9px; border-radius:0 2px 2px 0; }
        .bar-40 { opacity:1; } .bar-30 { opacity:0.8; } .bar-20 { opacity:0.6; } .bar-10 { opacity:0.4; }
        .dim-name { font-size:13px; font-weight:600; color:var(--text-primary); }
        .dim-weight { font-size:10.5px; color:var(--text-secondary); margin-top:2px; opacity:0.8; }
        .method-line { margin-top:16px; font-size:12px; color:var(--text-primary); opacity:0.8; line-height:1.6; }

        .field-footer { margin-top:24px; padding-top:20px; border-top:1px solid var(--hairline);
          display:flex; align-items:flex-end; justify-content:space-between; gap:20px; }
        .issuer-lockup { display:flex; align-items:center; gap:11px; }
        .devsim-mark { width:40px; height:40px; flex-shrink:0; }
        .issued-by { font-size:9.5px; letter-spacing:0.18em; text-transform:uppercase; color:var(--text-secondary); font-weight:600; }
        .issuer-name { font-size:17px; font-weight:700; color:var(--text-primary); margin-top:2px; text-decoration:none; display:block; }
        .verify { text-align:right; font-size:11px; line-height:1.8; text-decoration:none; }
        .cred-id { color:var(--text-primary); font-weight:700; }
        .verify-url { color:var(--text-secondary); font-weight:500; margin-top:2px; }

        .cert-actions { display:flex; gap:12px; flex-wrap:wrap; justify-content:center; }
        .btn { display:inline-flex; align-items:center; gap:8px; font-family:'Tomorrow',sans-serif; font-size:14px;
          font-weight:600; padding:11px 20px; border-radius:10px; cursor:pointer; border:none; text-decoration:none; transition:filter .15s; }
        .btn:hover { filter:brightness(1.05); }
        .btn-linkedin { background:#0A66C2; color:#FFF; }
        .btn-copy { background:#195792; color:#FFF; }
        .btn-pdf { background:#E86F24; color:#FFF; }

        @media (max-width:1180px){ .cert-scroll { width:100%; } }
        @media print {
          @page { size:A4 landscape; margin:0; }
          body { background:#FFF; }
          .cert-page { padding:0; background:#FFF; gap:0; }
          .cert-actions { display:none; }
          .certificate { box-shadow:none; }
        }
      `}</style>

      <div className="cert-page">
        <div className="cert-scroll">
          <div className="certificate">

            {/* LEFT RAIL — the event */}
            <aside className="rail">
              <div className="rail-accent" />
              <div className="rail-eyebrow">Assessment Event</div>
              <div className="rail-title">LMKR DevFest &rsquo;26</div>

              <div className="hosted-section">
                <div className="hosted-label">Hosted by</div>
                <a href="https://lmkr.com/" target="_blank" rel="noopener noreferrer" className="lmkr-logo"
                  dangerouslySetInnerHTML={{ __html: LMKR_SVG }} />
              </div>

              <div className="rail-meta">
                <span className="rail-label">Issued</span>
                <strong>{issued}</strong>
              </div>
            </aside>

            {/* MAIN FIELD — the credential */}
            <main className="main-field">
              <header className="field-header">
                <div className="cert-title">CERTIFICATE OF<br />PARTICIPATION</div>
                <div className="devfest-logo">
                  <div className="devfest-logo-inner" dangerouslySetInnerHTML={{ __html: DEVFEST_SVG }} />
                </div>
              </header>

              <div className="presentation-block">
                <div className="presented-to">This certificate is proudly presented to</div>
                <h1 className="candidate-name">{cert.recipientName || `@${cert.githubUsername}`}</h1>
                <div className="name-rule" />
                <div className="category-block">
                  <div className="category-label">Category</div>
                  <div className="category-value">{cert.category ?? "Participant"}</div>
                </div>
                <div className="attainment">
                  <p>In recognition of successfully completing the <span className="accent-bold">LMKR DEVFEST 2026</span> Coding Challenge and demonstrating excellence across four core competency areas.</p>
                </div>
              </div>

              <div className="spectrum">
                <div className="spectrum-label">Core Competencies</div>
                <div className="dimensions">
                  <div className="dim d40"><div className="bar bar-40" /><div className="dim-name">Diagnosis</div><div className="dim-weight">40 pts</div></div>
                  <div className="dim d30"><div className="bar bar-30" /><div className="dim-name">Design</div><div className="dim-weight">30 pts</div></div>
                  <div className="dim d20"><div className="bar bar-20" /><div className="dim-name">Communication</div><div className="dim-weight">20 pts</div></div>
                  <div className="dim d10"><div className="bar bar-10" /><div className="dim-name">Execution</div><div className="dim-weight">10 pts</div></div>
                </div>
                <div className="method-line">
                  Assessment conducted through the DevSimulate platform using automated code review, pull request analysis, hidden test-case validation, and a spoken defense of the solution.
                </div>
              </div>

              <footer className="field-footer">
                <div className="issuer-lockup">
                  <span className="devsim-mark" dangerouslySetInnerHTML={{ __html: DEVSIM_SVG }} />
                  <div>
                    <div className="issued-by">Assessed &amp; issued by</div>
                    <a href="https://www.devsimulate.com/" target="_blank" rel="noopener noreferrer" className="issuer-name">DevSimulate</a>
                  </div>
                </div>
                <a href={certUrl} target="_blank" rel="noopener noreferrer" className="verify">
                  <div className="cred-id">{credId}</div>
                  <div className="verify-url">{verifyDisplay}</div>
                </a>
              </footer>
            </main>

          </div>
        </div>

        {/* Actions */}
        <div className="cert-actions">
          <a href={linkedInUrl} target="_blank" rel="noreferrer" className="btn btn-linkedin">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Add to LinkedIn
          </a>
          <button onClick={copyLink} className="btn btn-copy">{copied ? "✓ Copied!" : "Copy Link"}</button>
          <button onClick={() => window.print()} className="btn btn-pdf">Save as PDF</button>
        </div>
      </div>
    </>
  );
}
