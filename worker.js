export default {
  async fetch(request, env) {

    /* =========================================
       CORS
    ========================================= */

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    };


    /* =========================================
       PREFLIGHT
    ========================================= */

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }


    /* =========================================
       POST ONLY
    ========================================= */

    if (request.method !== "POST") {
      return jsonResponse(
        {
          ok: false,
          error: "Method Not Allowed"
        },
        405,
        corsHeaders
      );
    }


    try {

      /* =========================================
         CHECK SECRET
      ========================================= */

      if (!env.DISCORD_BOT_TOKEN) {
        console.error("DISCORD_BOT_TOKEN is not configured.");

        return jsonResponse(
          {
            ok: false,
            error: "Server configuration error"
          },
          500,
          corsHeaders
        );
      }


      /* =========================================
         READ BODY
      ========================================= */

      const multipart = (request.headers.get("Content-Type") || "").includes("multipart/form-data");
      let data, attachments = [];
      try {
        if(multipart){
          const body = await request.formData();
          data = JSON.parse(body.get("payload"));
          attachments = body.getAll("attachments");
        }else{
          data = await request.json();
        }
      }catch{
        return jsonResponse({ok:false,error:"送信データを読み取れません。"},400,corsHeaders);
      }
      if(!data || typeof data !== "object" || Array.isArray(data)){
        return jsonResponse({ok:false,error:"送信データが不正です。"},400,corsHeaders);
      }
      if(attachments.length > 4 || attachments.some(file => typeof file === "string" || !file.type.startsWith("image/") || !file.size) || attachments.reduce((sum,file) => sum + file.size,0) > 8 * 1024 * 1024){
        return jsonResponse({ok:false,error:"画像は最大4枚・合計8MBまでです。"},400,corsHeaders);
      }
      const purchaseEmail = clean(data.purchase_email);
      // Preserve the currently published JSON form during the rollout.
      if((multipart || purchaseEmail) && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(purchaseEmail) || purchaseEmail.length > 254)){
        return jsonResponse({ok:false,error:"購入時のメールアドレスを正しく入力してください。"},400,corsHeaders);
      }


      /* =========================================
         BASIC VALIDATION
      ========================================= */

      const profileName =
        clean(data.profile_name);

      const service =
        clean(data.service || data.member_service);

      const inquiryType =
        clean(data.inquiry_type);

      const content =
        clean(data.content);

      const urgency =
        clean(data.urgency) || "通常";

      const replyRequired =
        clean(data.reply_required);


      if (!profileName) {
        return jsonResponse(
          {
            ok: false,
            error: "Discordプロフィール名がありません。"
          },
          400,
          corsHeaders
        );
      }


      if (!inquiryType) {
        return jsonResponse(
          {
            ok: false,
            error: "お問い合わせ種類がありません。"
          },
          400,
          corsHeaders
        );
      }


      if (!content) {
        return jsonResponse(
          {
            ok: false,
            error: "お問い合わせ内容がありません。"
          },
          400,
          corsHeaders
        );
      }


      /* =========================================
         OPTIONAL DATA
      ========================================= */

      const relatedMember =
        clean(data.related_member);

      const incidentPlace =
        clean(data.incident_place);

      const evidence =
        clean(data.evidence);

      const desiredAction =
        clean(data.desired_action);

      const submittedAt =
        clean(data.submitted_at) ||
        new Date().toLocaleString(
          "ja-JP",
          {
            timeZone: "Asia/Tokyo"
          }
        );

      const submissionId =
        clean(data.submission_id);


      /* =========================================
         CHANNEL
      ========================================= */

      const CHANNEL_ID =
        "1540679157212778607";


      /* =========================================
         EMBED COLOR
      ========================================= */

      let embedColor = 0x6f63dc;


      if (
        urgency === "できれば早めに確認してほしい"
      ) {
        embedColor = 0xf59e0b;
      }


      if (
        urgency === "緊急性が高い"
      ) {
        embedColor = 0xdc2626;
      }


      /* =========================================
         TITLE
      ========================================= */

      let title =
        "📩 新しい運営お問い合わせ";


      if (service) {
        title =
          `📩 ${service}｜運営お問い合わせ`;
      }


      if (
        urgency === "緊急性が高い"
      ) {
        title =
          `🚨 ${service ? service + "｜" : ""}緊急お問い合わせ`;
      }


      /* =========================================
         EMBED FIELDS
      ========================================= */

      const fields = [];


      if (service) {
        fields.push({
          name: "参加サービス",
          value: discordText(service, 1024),
          inline: true
        });
      }


      if(purchaseEmail){
        fields.push({name:"Teachable購入時のメールアドレス",value:purchaseEmail,inline:false});
      }
      fields.push(
        {
          name: "Discordプロフィール名",
          value: discordText(profileName, 1024),
          inline: true
        },
        {
          name: "お問い合わせ種類",
          value: discordText(inquiryType, 1024),
          inline: true
        },
        {
          name: "確認の優先度",
          value: discordText(urgency, 1024),
          inline: true
        },
        {
          name: "返信",
          value: discordText(
            replyRequired || "未選択",
            1024
          ),
          inline: true
        }
      );


      fields.push({
        name: "お問い合わせ内容",
        value: discordText(content, 1024),
        inline: false
      });


      if (relatedMember) {
        fields.push({
          name: "関係するメンバー",
          value: discordText(
            relatedMember,
            1024
          ),
          inline: false
        });
      }


      if (incidentPlace) {
        fields.push({
          name: "発生時期・場所",
          value: discordText(
            incidentPlace,
            1024
          ),
          inline: false
        });
      }


      if (evidence) {
        fields.push({
          name: "証拠・スクリーンショット等",
          value: discordText(
            evidence,
            1024
          ),
          inline: false
        });
      }


      if (desiredAction) {
        fields.push({
          name: "希望する対応",
          value: discordText(
            desiredAction,
            1024
          ),
          inline: false
        });
      }


      /* =========================================
         DISCORD PAYLOAD
      ========================================= */

      const payload = {

        allowed_mentions: {
          parse: []
        },

        embeds: [
          {
            title,

            description:
              urgency === "緊急性が高い"
                ? "⚠️ **緊急性が高いとして送信されています。**"
                : "参加メンバーから新しいお問い合わせが届きました。",

            color: embedColor,

            fields,

            footer: {
              text:
                submissionId
                  ? `受付日時：${submittedAt} ｜ ID：${submissionId}`
                  : `受付日時：${submittedAt}`
            },

            timestamp:
              new Date().toISOString()
          }
        ]
      };


      /* =========================================
         SEND TO DISCORD
      ========================================= */

      // Discord limits all embed text in a message to 6000 characters.
      let budget = 5400;
      for(const [index, field] of fields.entries()){
        const reserve = fields.slice(index + 1).reduce((sum, next) => sum + next.name.length + 100, 0);
        const limit = Math.max(1, Math.min(1024, budget - field.name.length - reserve));
        field.value = discordText(field.value, limit);
        budget -= field.name.length + field.value.length;
      }
      const headers = {Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`};
      let body;
      if(attachments.length){
        payload.attachments = attachments.map((file,id) => ({id, filename: file.name.replace(/[^a-zA-Z0-9._-]/g,"_") || `image-${id}.png`}));
        body = new FormData();
        body.append("payload_json", JSON.stringify(payload));
        attachments.forEach((file,id) => body.append(`files[${id}]`,file,payload.attachments[id].filename));
      }else{
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(payload);
      }
      const discordResponse = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`,{method:"POST",headers,body});

      /* =========================================
         DISCORD ERROR
      ========================================= */

      if (!discordResponse.ok) {

        const errorText =
          await discordResponse.text();

        console.error(
          "Discord API Error:",
          discordResponse.status,
          errorText
        );


        return jsonResponse(
          {
            ok: false,
            error: "Discordへの通知に失敗しました。"
          },
          502,
          corsHeaders
        );
      }


      /* =========================================
         SUCCESS
      ========================================= */

      const posted = await discordResponse.json();
      const emailConfirmed = !purchaseEmail || posted.embeds?.some(embed => embed.fields?.some(field => field.name === "Teachable購入時のメールアドレス" && field.value === purchaseEmail));
      const imagesConfirmed = (posted.attachments || []).length === attachments.length;
      if(posted.channel_id !== CHANNEL_ID || !emailConfirmed || !imagesConfirmed){
        return jsonResponse({ok:false,error:"通知内容の確認に失敗しました。再送前に運営へご確認ください。"},502,corsHeaders);
      }
      return jsonResponse(
        {
          ok: true,
          message_id: posted.id,
          attachment_count: posted.attachments.length,
          purchase_email_confirmed: !!purchaseEmail && emailConfirmed
        },
        200,
        corsHeaders
      );


    } catch (error) {

      console.error(
        "Worker Error:",
        error
      );


      return jsonResponse(
        {
          ok: false,
          error: "サーバーエラーが発生しました。"
        },
        500,
        corsHeaders
      );

    }

  }
};


/* =========================================
   CLEAN
========================================= */

function clean(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .trim();

}


/* =========================================
   DISCORD TEXT

   Discord Embed field上限対策
========================================= */

function discordText(
  value,
  maxLength
) {

  const text =
    clean(value) || "未入力";

  if (
    text.length <= maxLength
  ) {
    return text;
  }

  return (
    text.slice(
      0,
      maxLength - 3
    ) + "..."
  );

}


/* =========================================
   JSON RESPONSE
========================================= */

function jsonResponse(
  data,
  status,
  corsHeaders
) {

  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=UTF-8"
      }
    }
  );

}
