import { ImageResponse } from "next/og";
export const alt = "File Extract: extraia ZIP, texto de PDF e OCR de imagens online";
export const size = {width:1200,height:630};
export const contentType = "image/png";
export default function Image() {
 return new ImageResponse(<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",justifyContent:"center",background:"#0b1320",color:"#eaf1fb",padding:80,fontFamily:"sans-serif"}}><div style={{fontSize:28,color:"#54def4",letterSpacing:5,display:"flex"}}>FILE EXTRACT</div><div style={{fontSize:76,lineHeight:1.08,fontWeight:700,marginTop:32,display:"flex"}}>ZIP e PDF.<br/>Conteúdo ao seu alcance.</div><div style={{fontSize:28,color:"#b4fa63",marginTop:36,display:"flex"}}>Extraia · Pesquise · Explore</div></div>,size);
}
