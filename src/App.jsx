import React, { useState, useMemo, useEffect } from "react";

const THEMES = {
  light: {
    bg:"#f6f8f6", surface:"#ffffff", card:"#ffffff", border:"#e3e8e4",
    accent:"#1f7a55", onAccent:"#ffffff", danger:"#c34a4a", warn:"#b07d18",
    blue:"#3f7fae", purple:"#7a6ad0", text:"#162019", muted:"#697971",
  },
  dark: {
    bg:"#0f1411", surface:"#161f1a", card:"#1c2822", border:"#283831",
    accent:"#3f9e74", onAccent:"#ffffff", danger:"#e0737a", warn:"#d2a44e",
    blue:"#5a9fcf", purple:"#a394e6", text:"#e9f1ec", muted:"#88998f",
  },
};
let C = THEMES.light;

const INIT_CAT = [{"id":"1","buyPrice":12.2,"status":"stock","addedAt":"01/01/2024"},{"id":"2","buyPrice":26.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"3","buyPrice":14.99,"status":"stock","addedAt":"01/01/2024"},{"id":"4","buyPrice":14.28,"status":"stock","addedAt":"01/01/2024"},{"id":"5","buyPrice":25.81,"status":"stock","addedAt":"01/01/2024"},{"id":"6","buyPrice":11.22,"status":"vendu","addedAt":"01/01/2024"},{"id":"7","buyPrice":12.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"8","buyPrice":24.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"9","buyPrice":6.69,"status":"stock","addedAt":"01/01/2024"},{"id":"10","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"11","buyPrice":24.69,"status":"stock","addedAt":"01/01/2024"},{"id":"12","buyPrice":10.89,"status":"stock","addedAt":"01/01/2024"},{"id":"13","buyPrice":31.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"14","buyPrice":25.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"15","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"16","buyPrice":8.1,"status":"vendu","addedAt":"01/01/2024"},{"id":"17","buyPrice":25.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"18","buyPrice":17.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"19","buyPrice":17.69,"status":"stock","addedAt":"01/01/2024"},{"id":"20","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"21","buyPrice":33.06,"status":"vendu","addedAt":"01/01/2024"},{"id":"22","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"23","buyPrice":9.82,"status":"stock","addedAt":"01/01/2024"},{"id":"24","buyPrice":15.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"25","buyPrice":27.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"26","buyPrice":20.1,"status":"vendu","addedAt":"01/01/2024"},{"id":"27","buyPrice":36.65,"status":"vendu","addedAt":"01/01/2024"},{"id":"28","buyPrice":12.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"29","buyPrice":7.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"30","buyPrice":12.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"31","buyPrice":14.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"32","buyPrice":14.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"33","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"34","buyPrice":16.39,"status":"stock","addedAt":"01/01/2024"},{"id":"35","buyPrice":16.68,"status":"stock","addedAt":"01/01/2024"},{"id":"36","buyPrice":19.73,"status":"vendu","addedAt":"01/01/2024"},{"id":"37","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"38","buyPrice":7.06,"status":"stock","addedAt":"01/01/2024"},{"id":"39","buyPrice":20.84,"status":"stock","addedAt":"01/01/2024"},{"id":"40","buyPrice":10.18,"status":"vendu","addedAt":"01/01/2024"},{"id":"41","buyPrice":15.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"42","buyPrice":17.805,"status":"vendu","addedAt":"01/01/2024"},{"id":"43","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"44","buyPrice":35.11,"status":"vendu","addedAt":"01/01/2024"},{"id":"45","buyPrice":14.28,"status":"vendu","addedAt":"01/01/2024"},{"id":"46","buyPrice":22.42,"status":"vendu","addedAt":"01/01/2024"},{"id":"47","buyPrice":21.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"48","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"49","buyPrice":11.0,"status":"stock","addedAt":"01/01/2024"},{"id":"50","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"51","buyPrice":24.7,"status":"stock","addedAt":"01/01/2024"},{"id":"52","buyPrice":17.27,"status":"vendu","addedAt":"01/01/2024"},{"id":"53","buyPrice":13.11,"status":"vendu","addedAt":"01/01/2024"},{"id":"54","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"55","buyPrice":6.8,"status":"vendu","addedAt":"01/01/2024"},{"id":"56","buyPrice":19.3,"status":"stock","addedAt":"01/01/2024"},{"id":"57","buyPrice":37.32,"status":"vendu","addedAt":"01/01/2024"},{"id":"58","buyPrice":29.71,"status":"vendu","addedAt":"01/01/2024"},{"id":"59","buyPrice":29.71,"status":"vendu","addedAt":"01/01/2024"},{"id":"60","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"61","buyPrice":14.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"62","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"63","buyPrice":20.4,"status":"vendu","addedAt":"01/01/2024"},{"id":"64","buyPrice":15.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"65","buyPrice":22.94,"status":"vendu","addedAt":"01/01/2024"},{"id":"66","buyPrice":1.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"67","buyPrice":23.015,"status":"vendu","addedAt":"01/01/2024"},{"id":"68","buyPrice":12.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"69","buyPrice":13.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"70","buyPrice":8.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"71","buyPrice":16.21,"status":"vendu","addedAt":"01/01/2024"},{"id":"72","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"73","buyPrice":24.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"74","buyPrice":27.42,"status":"vendu","addedAt":"01/01/2024"},{"id":"75","buyPrice":16.36,"status":"vendu","addedAt":"01/01/2024"},{"id":"76","buyPrice":20.64,"status":"vendu","addedAt":"01/01/2024"},{"id":"77","buyPrice":25.21,"status":"vendu","addedAt":"01/01/2024"},{"id":"78","buyPrice":19.36,"status":"vendu","addedAt":"01/01/2024"},{"id":"79","buyPrice":10.72,"status":"stock","addedAt":"01/01/2024"},{"id":"80","buyPrice":12.26,"status":"stock","addedAt":"01/01/2024"},{"id":"81","buyPrice":20.1,"status":"vendu","addedAt":"01/01/2024"},{"id":"82","buyPrice":21.035,"status":"vendu","addedAt":"01/01/2024"},{"id":"83","buyPrice":15.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"84","buyPrice":20.64,"status":"stock","addedAt":"01/01/2024"},{"id":"85","buyPrice":30.4,"status":"vendu","addedAt":"01/01/2024"},{"id":"86","buyPrice":31.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"87","buyPrice":23.015,"status":"vendu","addedAt":"01/01/2024"},{"id":"88","buyPrice":13.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"89","buyPrice":17.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"90","buyPrice":25.61,"status":"stock","addedAt":"01/01/2024"},{"id":"91","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"92","buyPrice":14.28,"status":"stock","addedAt":"01/01/2024"},{"id":"93","buyPrice":7.55,"status":"vendu","addedAt":"01/01/2024"},{"id":"94","buyPrice":7.55,"status":"vendu","addedAt":"01/01/2024"},{"id":"95","buyPrice":7.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"96","buyPrice":23.91,"status":"vendu","addedAt":"01/01/2024"},{"id":"97","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"98","buyPrice":14.97,"status":"vendu","addedAt":"01/01/2024"},{"id":"99","buyPrice":13.945,"status":"vendu","addedAt":"01/01/2024"},{"id":"100","buyPrice":15.59,"status":"stock","addedAt":"01/01/2024"},{"id":"101","buyPrice":15.13,"status":"vendu","addedAt":"01/01/2024"},{"id":"102","buyPrice":14.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"103","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"104","buyPrice":9.68,"status":"stock","addedAt":"01/01/2024"},{"id":"105","buyPrice":26.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"106","buyPrice":15.96,"status":"vendu","addedAt":"01/01/2024"},{"id":"107","buyPrice":12.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"108","buyPrice":17.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"109","buyPrice":22.21,"status":"vendu","addedAt":"01/01/2024"},{"id":"110","buyPrice":26.35,"status":"vendu","addedAt":"01/01/2024"},{"id":"111","buyPrice":14.855,"status":"vendu","addedAt":"01/01/2024"},{"id":"112","buyPrice":14.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"113","buyPrice":35.72,"status":"stock","addedAt":"01/01/2024"},{"id":"114","buyPrice":12.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"115","buyPrice":23.32,"status":"vendu","addedAt":"01/01/2024"},{"id":"116","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"117","buyPrice":25.51,"status":"stock","addedAt":"01/01/2024"},{"id":"118","buyPrice":9.68,"status":"vendu","addedAt":"01/01/2024"},{"id":"119","buyPrice":19.09,"status":"stock","addedAt":"01/01/2024"},{"id":"120","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"121","buyPrice":12.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"122","buyPrice":25.81,"status":"stock","addedAt":"01/01/2024"},{"id":"123","buyPrice":13.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"124","buyPrice":25.92,"status":"vendu","addedAt":"01/01/2024"},{"id":"125","buyPrice":25.81,"status":"stock","addedAt":"01/01/2024"},{"id":"126","buyPrice":18.755,"status":"vendu","addedAt":"01/01/2024"},{"id":"127","buyPrice":18.755,"status":"stock","addedAt":"01/01/2024"},{"id":"128","buyPrice":8.67,"status":"vendu","addedAt":"01/01/2024"},{"id":"129","buyPrice":18.755,"status":"vendu","addedAt":"01/01/2024"},{"id":"130","buyPrice":25.92,"status":"vendu","addedAt":"01/01/2024"},{"id":"131","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"132","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"133","buyPrice":14.28,"status":"vendu","addedAt":"01/01/2024"},{"id":"134","buyPrice":18.755,"status":"vendu","addedAt":"01/01/2024"},{"id":"135","buyPrice":14.28,"status":"vendu","addedAt":"01/01/2024"},{"id":"136","buyPrice":13.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"137","buyPrice":20.25,"status":"vendu","addedAt":"01/01/2024"},{"id":"138","buyPrice":18.05,"status":"vendu","addedAt":"01/01/2024"},{"id":"139","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"140","buyPrice":18.755,"status":"vendu","addedAt":"01/01/2024"},{"id":"141","buyPrice":25.61,"status":"vendu","addedAt":"01/01/2024"},{"id":"142","buyPrice":15.19,"status":"stock","addedAt":"01/01/2024"},{"id":"143","buyPrice":8.78,"status":"vendu","addedAt":"01/01/2024"},{"id":"144","buyPrice":13.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"145","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"146","buyPrice":23.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"147","buyPrice":9.14,"status":"vendu","addedAt":"01/01/2024"},{"id":"148","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"149","buyPrice":25.59,"status":"stock","addedAt":"01/01/2024"},{"id":"150","buyPrice":18.755,"status":"vendu","addedAt":"01/01/2024"},{"id":"151","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"152","buyPrice":8.1,"status":"vendu","addedAt":"01/01/2024"},{"id":"153","buyPrice":15.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"154","buyPrice":21.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"155","buyPrice":25.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"156","buyPrice":24.76,"status":"vendu","addedAt":"01/01/2024"},{"id":"157","buyPrice":14.29,"status":"stock","addedAt":"01/01/2024"},{"id":"158","buyPrice":12.2,"status":"stock","addedAt":"01/01/2024"},{"id":"159","buyPrice":20.64,"status":"vendu","addedAt":"01/01/2024"},{"id":"160","buyPrice":20.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"161","buyPrice":20.64,"status":"vendu","addedAt":"01/01/2024"},{"id":"162","buyPrice":25.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"163","buyPrice":21.04,"status":"stock","addedAt":"01/01/2024"},{"id":"164","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"165","buyPrice":17.49,"status":"stock","addedAt":"01/01/2024"},{"id":"166","buyPrice":15.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"167","buyPrice":14.99,"status":"stock","addedAt":"01/01/2024"},{"id":"168","buyPrice":25.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"169","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"170","buyPrice":21.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"171","buyPrice":20.64,"status":"vendu","addedAt":"01/01/2024"},{"id":"172","buyPrice":10.14,"status":"vendu","addedAt":"01/01/2024"},{"id":"173","buyPrice":19.73,"status":"vendu","addedAt":"01/01/2024"},{"id":"174","buyPrice":19.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"175","buyPrice":21.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"176","buyPrice":17.27,"status":"vendu","addedAt":"01/01/2024"},{"id":"177","buyPrice":26.85,"status":"vendu","addedAt":"01/01/2024"},{"id":"178","buyPrice":28.73,"status":"vendu","addedAt":"01/01/2024"},{"id":"179","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"180","buyPrice":9.68,"status":"vendu","addedAt":"01/01/2024"},{"id":"181","buyPrice":28.53,"status":"vendu","addedAt":"01/01/2024"},{"id":"182","buyPrice":28.53,"status":"vendu","addedAt":"01/01/2024"},{"id":"183","buyPrice":31.13,"status":"vendu","addedAt":"01/01/2024"},{"id":"184","buyPrice":28.53,"status":"vendu","addedAt":"01/01/2024"},{"id":"185","buyPrice":28.53,"status":"vendu","addedAt":"01/01/2024"},{"id":"186","buyPrice":38.945,"status":"vendu","addedAt":"01/01/2024"},{"id":"187","buyPrice":35.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"188","buyPrice":28.71,"status":"vendu","addedAt":"01/01/2024"},{"id":"189","buyPrice":14.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"190","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"191","buyPrice":19.73,"status":"vendu","addedAt":"01/01/2024"},{"id":"192","buyPrice":14.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"193","buyPrice":17.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"194","buyPrice":14.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"195","buyPrice":14.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"196","buyPrice":27.67,"status":"vendu","addedAt":"01/01/2024"},{"id":"197","buyPrice":26.14,"status":"vendu","addedAt":"01/01/2024"},{"id":"198","buyPrice":14.09,"status":"stock","addedAt":"01/01/2024"},{"id":"199","buyPrice":14.19,"status":"stock","addedAt":"01/01/2024"},{"id":"200","buyPrice":17.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"201","buyPrice":20.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"202","buyPrice":20.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"203","buyPrice":19.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"204","buyPrice":20.8,"status":"vendu","addedAt":"01/01/2024"},{"id":"205","buyPrice":19.76,"status":"vendu","addedAt":"01/01/2024"},{"id":"206","buyPrice":24.98,"status":"vendu","addedAt":"01/01/2024"},{"id":"207","buyPrice":11.2,"status":"stock","addedAt":"01/01/2024"},{"id":"208","buyPrice":15.69,"status":"stock","addedAt":"01/01/2024"},{"id":"209","buyPrice":22.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"210","buyPrice":19.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"211","buyPrice":13.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"212","buyPrice":17.98,"status":"vendu","addedAt":"01/01/2024"},{"id":"213","buyPrice":21.04,"status":"vendu","addedAt":"01/01/2024"},{"id":"214","buyPrice":19.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"215","buyPrice":25.81,"status":"stock","addedAt":"01/01/2024"},{"id":"216","buyPrice":11.0,"status":"stock","addedAt":"01/01/2024"},{"id":"217","buyPrice":23.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"218","buyPrice":10.18,"status":"vendu","addedAt":"01/01/2024"},{"id":"219","buyPrice":26.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"220","buyPrice":21.38,"status":"vendu","addedAt":"01/01/2024"},{"id":"221","buyPrice":20.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"222","buyPrice":14.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"223","buyPrice":18.74,"status":"vendu","addedAt":"01/01/2024"},{"id":"224","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"225","buyPrice":24.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"226","buyPrice":16.86,"status":"vendu","addedAt":"01/01/2024"},{"id":"227","buyPrice":24.78,"status":"stock","addedAt":"01/01/2024"},{"id":"228","buyPrice":22.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"229","buyPrice":20.8,"status":"vendu","addedAt":"01/01/2024"},{"id":"230","buyPrice":22.27,"status":"vendu","addedAt":"01/01/2024"},{"id":"231","buyPrice":17.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"232","buyPrice":21.04,"status":"vendu","addedAt":"01/01/2024"},{"id":"233","buyPrice":19.73,"status":"vendu","addedAt":"01/01/2024"},{"id":"234","buyPrice":17.59,"status":"stock","addedAt":"01/01/2024"},{"id":"235","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"236","buyPrice":27.45,"status":"vendu","addedAt":"01/01/2024"},{"id":"237","buyPrice":27.45,"status":"vendu","addedAt":"01/01/2024"},{"id":"238","buyPrice":15.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"239","buyPrice":24.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"240","buyPrice":11.67,"status":"vendu","addedAt":"01/01/2024"},{"id":"241","buyPrice":24.895,"status":"vendu","addedAt":"01/01/2024"},{"id":"242","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"243","buyPrice":0.0,"status":"stock","addedAt":"01/01/2024"},{"id":"244","buyPrice":21.42,"status":"vendu","addedAt":"01/01/2024"},{"id":"245","buyPrice":10.25,"status":"vendu","addedAt":"01/01/2024"},{"id":"246","buyPrice":23.62,"status":"vendu","addedAt":"01/01/2024"},{"id":"247","buyPrice":24.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"248","buyPrice":13.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"249","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"250","buyPrice":25.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"251","buyPrice":24.895,"status":"vendu","addedAt":"01/01/2024"},{"id":"252","buyPrice":20.8,"status":"vendu","addedAt":"01/01/2024"},{"id":"253","buyPrice":24.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"254","buyPrice":24.72,"status":"vendu","addedAt":"01/01/2024"},{"id":"255","buyPrice":1.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"256","buyPrice":24.895,"status":"vendu","addedAt":"01/01/2024"},{"id":"257","buyPrice":19.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"258","buyPrice":8.64,"status":"vendu","addedAt":"01/01/2024"},{"id":"259","buyPrice":20.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"260","buyPrice":22.18,"status":"vendu","addedAt":"01/01/2024"},{"id":"261","buyPrice":14.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"262","buyPrice":14.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"263","buyPrice":23.38,"status":"stock","addedAt":"01/01/2024"},{"id":"264","buyPrice":22.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"265","buyPrice":14.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"266","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"267","buyPrice":1.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"268","buyPrice":20.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"269","buyPrice":14.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"270","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"271","buyPrice":14.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"272","buyPrice":21.57,"status":"vendu","addedAt":"01/01/2024"},{"id":"273","buyPrice":19.06,"status":"vendu","addedAt":"01/01/2024"},{"id":"274","buyPrice":23.72,"status":"vendu","addedAt":"01/01/2024"},{"id":"275","buyPrice":22.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"276","buyPrice":14.79,"status":"stock","addedAt":"01/01/2024"},{"id":"277","buyPrice":21.64,"status":"vendu","addedAt":"01/01/2024"},{"id":"278","buyPrice":15.39,"status":"stock","addedAt":"01/01/2024"},{"id":"279","buyPrice":9.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"280","buyPrice":1.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"281","buyPrice":0.0,"status":"stock","addedAt":"01/01/2024"},{"id":"282","buyPrice":24.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"283","buyPrice":14.92,"status":"vendu","addedAt":"01/01/2024"},{"id":"284","buyPrice":15.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"285","buyPrice":15.58,"status":"vendu","addedAt":"01/01/2024"},{"id":"286","buyPrice":0.0,"status":"stock","addedAt":"01/01/2024"},{"id":"287","buyPrice":14.19,"status":"stock","addedAt":"01/01/2024"},{"id":"288","buyPrice":12.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"289","buyPrice":26.85,"status":"vendu","addedAt":"01/01/2024"},{"id":"290","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"291","buyPrice":23.72,"status":"vendu","addedAt":"01/01/2024"},{"id":"292","buyPrice":16.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"293","buyPrice":24.76,"status":"vendu","addedAt":"01/01/2024"},{"id":"294","buyPrice":26.85,"status":"vendu","addedAt":"01/01/2024"},{"id":"295","buyPrice":30.4,"status":"vendu","addedAt":"01/01/2024"},{"id":"296","buyPrice":14.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"297","buyPrice":22.42,"status":"vendu","addedAt":"01/01/2024"},{"id":"298","buyPrice":11.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"299","buyPrice":22.61,"status":"vendu","addedAt":"01/01/2024"},{"id":"300","buyPrice":20.24,"status":"stock","addedAt":"01/01/2024"},{"id":"301","buyPrice":24.895,"status":"vendu","addedAt":"01/01/2024"},{"id":"302","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"303","buyPrice":5.95,"status":"vendu","addedAt":"01/01/2024"},{"id":"304","buyPrice":25.74,"status":"stock","addedAt":"01/01/2024"},{"id":"305","buyPrice":25.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"306","buyPrice":24.895,"status":"vendu","addedAt":"01/01/2024"},{"id":"307","buyPrice":14.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"308","buyPrice":17.47,"status":"vendu","addedAt":"01/01/2024"},{"id":"309","buyPrice":13.05,"status":"stock","addedAt":"01/01/2024"},{"id":"310","buyPrice":6.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"311","buyPrice":14.28,"status":"vendu","addedAt":"01/01/2024"},{"id":"312","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"313","buyPrice":30.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"314","buyPrice":17.94,"status":"vendu","addedAt":"01/01/2024"},{"id":"315","buyPrice":14.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"316","buyPrice":20.34,"status":"stock","addedAt":"01/01/2024"},{"id":"317","buyPrice":23.21,"status":"vendu","addedAt":"01/01/2024"},{"id":"318","buyPrice":19.3,"status":"stock","addedAt":"01/01/2024"},{"id":"319","buyPrice":32.06,"status":"vendu","addedAt":"01/01/2024"},{"id":"320","buyPrice":17.94,"status":"vendu","addedAt":"01/01/2024"},{"id":"321","buyPrice":16.29,"status":"stock","addedAt":"01/01/2024"},{"id":"322","buyPrice":15.55,"status":"vendu","addedAt":"01/01/2024"},{"id":"323","buyPrice":1.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"324","buyPrice":9.04,"status":"vendu","addedAt":"01/01/2024"},{"id":"325","buyPrice":20.27,"status":"vendu","addedAt":"01/01/2024"},{"id":"326","buyPrice":16.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"327","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"328","buyPrice":26.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"329","buyPrice":15.32,"status":"vendu","addedAt":"01/01/2024"},{"id":"330","buyPrice":14.35,"status":"vendu","addedAt":"01/01/2024"},{"id":"331","buyPrice":13.85,"status":"vendu","addedAt":"01/01/2024"},{"id":"332","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"333","buyPrice":14.29,"status":"stock","addedAt":"01/01/2024"},{"id":"334","buyPrice":20.27,"status":"vendu","addedAt":"01/01/2024"},{"id":"335","buyPrice":11.53,"status":"vendu","addedAt":"01/01/2024"},{"id":"336","buyPrice":20.64,"status":"vendu","addedAt":"01/01/2024"},{"id":"337","buyPrice":15.09,"status":"stock","addedAt":"01/01/2024"},{"id":"338","buyPrice":26.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"339","buyPrice":1.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"340","buyPrice":15.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"341","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"342","buyPrice":20.74,"status":"vendu","addedAt":"01/01/2024"},{"id":"343","buyPrice":11.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"344","buyPrice":20.7,"status":"stock","addedAt":"01/01/2024"},{"id":"345","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"346","buyPrice":14.29,"status":"stock","addedAt":"01/01/2024"},{"id":"347","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"348","buyPrice":15.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"349","buyPrice":13.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"350","buyPrice":21.94,"status":"vendu","addedAt":"01/01/2024"},{"id":"351","buyPrice":14.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"352","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"353","buyPrice":15.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"354","buyPrice":9.58,"status":"vendu","addedAt":"01/01/2024"},{"id":"355","buyPrice":14.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"356","buyPrice":29.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"357","buyPrice":29.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"358","buyPrice":29.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"359","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"360","buyPrice":18.11,"status":"vendu","addedAt":"01/01/2024"},{"id":"361","buyPrice":16.92,"status":"vendu","addedAt":"01/01/2024"},{"id":"362","buyPrice":6.94,"status":"stock","addedAt":"01/01/2024"},{"id":"363","buyPrice":22.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"364","buyPrice":19.33,"status":"vendu","addedAt":"01/01/2024"},{"id":"365","buyPrice":10.27,"status":"vendu","addedAt":"01/01/2024"},{"id":"366","buyPrice":19.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"367","buyPrice":20.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"368","buyPrice":15.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"369","buyPrice":15.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"370","buyPrice":48.46,"status":"vendu","addedAt":"01/01/2024"},{"id":"371","buyPrice":19.18,"status":"stock","addedAt":"01/01/2024"},{"id":"372","buyPrice":14.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"373","buyPrice":20.64,"status":"vendu","addedAt":"01/01/2024"},{"id":"374","buyPrice":12.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"375","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"376","buyPrice":8.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"377","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"378","buyPrice":20.6,"status":"stock","addedAt":"01/01/2024"},{"id":"379","buyPrice":16.23,"status":"stock","addedAt":"01/01/2024"},{"id":"380","buyPrice":14.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"381","buyPrice":26.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"382","buyPrice":14.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"383","buyPrice":13.71,"status":"vendu","addedAt":"01/01/2024"},{"id":"384","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"385","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"386","buyPrice":14.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"387","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"388","buyPrice":14.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"389","buyPrice":11.49,"status":"stock","addedAt":"01/01/2024"},{"id":"390","buyPrice":15.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"391","buyPrice":16.36,"status":"vendu","addedAt":"01/01/2024"},{"id":"392","buyPrice":20.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"393","buyPrice":15.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"394","buyPrice":12.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"395","buyPrice":12.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"396","buyPrice":11.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"397","buyPrice":12.71,"status":"vendu","addedAt":"01/01/2024"},{"id":"398","buyPrice":36.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"399","buyPrice":26.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"400","buyPrice":12.84,"status":"stock","addedAt":"01/01/2024"},{"id":"401","buyPrice":21.64,"status":"vendu","addedAt":"01/01/2024"},{"id":"402","buyPrice":20.94,"status":"vendu","addedAt":"01/01/2024"},{"id":"403","buyPrice":18.14,"status":"vendu","addedAt":"01/01/2024"},{"id":"404","buyPrice":16.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"405","buyPrice":7.5,"status":"stock","addedAt":"01/01/2024"},{"id":"406","buyPrice":15.79,"status":"stock","addedAt":"01/01/2024"},{"id":"407","buyPrice":15.09,"status":"stock","addedAt":"01/01/2024"},{"id":"408","buyPrice":14.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"409","buyPrice":15.19,"status":"stock","addedAt":"01/01/2024"},{"id":"410","buyPrice":20.56,"status":"vendu","addedAt":"01/01/2024"},{"id":"411","buyPrice":15.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"412","buyPrice":20.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"413","buyPrice":21.64,"status":"vendu","addedAt":"01/01/2024"},{"id":"414","buyPrice":14.08,"status":"vendu","addedAt":"01/01/2024"},{"id":"415","buyPrice":22.74,"status":"vendu","addedAt":"01/01/2024"},{"id":"416","buyPrice":15.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"417","buyPrice":28.72,"status":"vendu","addedAt":"01/01/2024"},{"id":"418","buyPrice":24.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"419","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"420","buyPrice":23.72,"status":"vendu","addedAt":"01/01/2024"},{"id":"421","buyPrice":18.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"422","buyPrice":13.17,"status":"vendu","addedAt":"01/01/2024"},{"id":"423","buyPrice":14.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"424","buyPrice":11.28,"status":"vendu","addedAt":"01/01/2024"},{"id":"425","buyPrice":13.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"426","buyPrice":17.09,"status":"stock","addedAt":"01/01/2024"},{"id":"427","buyPrice":22.61,"status":"vendu","addedAt":"01/01/2024"},{"id":"428","buyPrice":18.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"429","buyPrice":11.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"430","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"431","buyPrice":15.09,"status":"stock","addedAt":"01/01/2024"},{"id":"432","buyPrice":17.805,"status":"vendu","addedAt":"01/01/2024"},{"id":"433","buyPrice":17.805,"status":"vendu","addedAt":"01/01/2024"},{"id":"434","buyPrice":20.24,"status":"stock","addedAt":"01/01/2024"},{"id":"435","buyPrice":12.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"436","buyPrice":26.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"437","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"438","buyPrice":15.09,"status":"stock","addedAt":"01/01/2024"},{"id":"439","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"440","buyPrice":14.75,"status":"stock","addedAt":"01/01/2024"},{"id":"441","buyPrice":14.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"442","buyPrice":17.09,"status":"stock","addedAt":"01/01/2024"},{"id":"443","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"444","buyPrice":21.54,"status":"stock","addedAt":"01/01/2024"},{"id":"445","buyPrice":14.44,"status":"stock","addedAt":"01/01/2024"},{"id":"446","buyPrice":15.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"447","buyPrice":17.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"448","buyPrice":16.59,"status":"stock","addedAt":"01/01/2024"},{"id":"449","buyPrice":16.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"450","buyPrice":45.53,"status":"vendu","addedAt":"01/01/2024"},{"id":"451","buyPrice":25.49,"status":"stock","addedAt":"01/01/2024"},{"id":"452","buyPrice":21.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"453","buyPrice":12.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"454","buyPrice":16.43,"status":"vendu","addedAt":"01/01/2024"},{"id":"455","buyPrice":18.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"456","buyPrice":18.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"457","buyPrice":16.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"458","buyPrice":16.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"459","buyPrice":9.07,"status":"vendu","addedAt":"01/01/2024"},{"id":"460","buyPrice":10.18,"status":"vendu","addedAt":"01/01/2024"},{"id":"461","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"462","buyPrice":29.36,"status":"vendu","addedAt":"01/01/2024"},{"id":"463","buyPrice":22.9,"status":"vendu","addedAt":"01/01/2024"},{"id":"464","buyPrice":12.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"465","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"466","buyPrice":14.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"467","buyPrice":13.99,"status":"stock","addedAt":"01/01/2024"},{"id":"468","buyPrice":14.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"469","buyPrice":13.85,"status":"stock","addedAt":"01/01/2024"},{"id":"470","buyPrice":25.71,"status":"vendu","addedAt":"01/01/2024"},{"id":"471","buyPrice":17.19,"status":"stock","addedAt":"01/01/2024"},{"id":"472","buyPrice":0.0,"status":"stock","addedAt":"01/01/2024"},{"id":"473","buyPrice":17.09,"status":"stock","addedAt":"01/01/2024"},{"id":"474","buyPrice":20.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"475","buyPrice":11.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"476","buyPrice":15.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"477","buyPrice":52.14,"status":"vendu","addedAt":"01/01/2024"},{"id":"478","buyPrice":26.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"479","buyPrice":26.21,"status":"vendu","addedAt":"01/01/2024"},{"id":"480","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"481","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"482","buyPrice":14.29,"status":"stock","addedAt":"01/01/2024"},{"id":"483","buyPrice":9.57,"status":"vendu","addedAt":"01/01/2024"},{"id":"484","buyPrice":10.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"485","buyPrice":12.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"486","buyPrice":17.49,"status":"stock","addedAt":"01/01/2024"},{"id":"487","buyPrice":14.04,"status":"vendu","addedAt":"01/01/2024"},{"id":"488","buyPrice":1.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"489","buyPrice":11.67,"status":"vendu","addedAt":"01/01/2024"},{"id":"490","buyPrice":20.53,"status":"stock","addedAt":"01/01/2024"},{"id":"491","buyPrice":11.61,"status":"vendu","addedAt":"01/01/2024"},{"id":"492","buyPrice":7.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"493","buyPrice":15.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"494","buyPrice":15.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"495","buyPrice":15.09,"status":"stock","addedAt":"01/01/2024"},{"id":"496","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"497","buyPrice":14.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"498","buyPrice":13.75,"status":"vendu","addedAt":"01/01/2024"},{"id":"499","buyPrice":25.74,"status":"vendu","addedAt":"01/01/2024"},{"id":"500","buyPrice":14.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"501","buyPrice":25.75,"status":"stock","addedAt":"01/01/2024"},{"id":"502","buyPrice":19.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"503","buyPrice":9.58,"status":"vendu","addedAt":"01/01/2024"},{"id":"504","buyPrice":15.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"505","buyPrice":15.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"506","buyPrice":15.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"507","buyPrice":23.25,"status":"vendu","addedAt":"01/01/2024"},{"id":"508","buyPrice":8.78,"status":"vendu","addedAt":"01/01/2024"},{"id":"509","buyPrice":15.19,"status":"stock","addedAt":"01/01/2024"},{"id":"510","buyPrice":16.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"511","buyPrice":18.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"512","buyPrice":15.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"513","buyPrice":11.15,"status":"vendu","addedAt":"01/01/2024"},{"id":"514","buyPrice":15.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"515","buyPrice":25.98,"status":"vendu","addedAt":"01/01/2024"},{"id":"516","buyPrice":37.32,"status":"vendu","addedAt":"01/01/2024"},{"id":"517","buyPrice":7.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"518","buyPrice":15.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"519","buyPrice":26.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"520","buyPrice":32.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"521","buyPrice":40.93,"status":"vendu","addedAt":"01/01/2024"},{"id":"522","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"523","buyPrice":24.91,"status":"vendu","addedAt":"01/01/2024"},{"id":"524","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"525","buyPrice":15.39,"status":"stock","addedAt":"01/01/2024"},{"id":"526","buyPrice":16.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"527","buyPrice":14.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"528","buyPrice":12.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"529","buyPrice":21.94,"status":"vendu","addedAt":"01/01/2024"},{"id":"530","buyPrice":14.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"531","buyPrice":13.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"532","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"533","buyPrice":24.4,"status":"stock","addedAt":"01/01/2024"},{"id":"534","buyPrice":20.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"535","buyPrice":16.46,"status":"vendu","addedAt":"01/01/2024"},{"id":"536","buyPrice":62.81,"status":"stock","addedAt":"01/01/2024"},{"id":"537","buyPrice":92.11,"status":"stock","addedAt":"01/01/2024"},{"id":"538","buyPrice":42.74,"status":"stock","addedAt":"01/01/2024"},{"id":"539","buyPrice":26.21,"status":"vendu","addedAt":"01/01/2024"},{"id":"540","buyPrice":14.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"541","buyPrice":11.9,"status":"vendu","addedAt":"01/01/2024"},{"id":"542","buyPrice":9.04,"status":"vendu","addedAt":"01/01/2024"},{"id":"543","buyPrice":14.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"544","buyPrice":14.18,"status":"vendu","addedAt":"01/01/2024"},{"id":"545","buyPrice":11.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"546","buyPrice":16.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"547","buyPrice":9.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"548","buyPrice":23.22,"status":"vendu","addedAt":"01/01/2024"},{"id":"549","buyPrice":27.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"550","buyPrice":25.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"551","buyPrice":12.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"552","buyPrice":42.84,"status":"stock","addedAt":"01/01/2024"},{"id":"553","buyPrice":15.96,"status":"vendu","addedAt":"01/01/2024"},{"id":"554","buyPrice":11.02,"status":"vendu","addedAt":"01/01/2024"},{"id":"555","buyPrice":22.94,"status":"vendu","addedAt":"01/01/2024"},{"id":"556","buyPrice":21.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"557","buyPrice":28.32,"status":"vendu","addedAt":"01/01/2024"},{"id":"558","buyPrice":26.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"559","buyPrice":15.96,"status":"vendu","addedAt":"01/01/2024"},{"id":"560","buyPrice":13.71,"status":"vendu","addedAt":"01/01/2024"},{"id":"561","buyPrice":18.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"562","buyPrice":22.04,"status":"vendu","addedAt":"01/01/2024"},{"id":"563","buyPrice":17.47,"status":"vendu","addedAt":"01/01/2024"},{"id":"564","buyPrice":15.69,"status":"stock","addedAt":"01/01/2024"},{"id":"565","buyPrice":19.54,"status":"stock","addedAt":"01/01/2024"},{"id":"566","buyPrice":25.49,"status":"stock","addedAt":"01/01/2024"},{"id":"567","buyPrice":9.84,"status":"stock","addedAt":"01/01/2024"},{"id":"568","buyPrice":15.96,"status":"stock","addedAt":"01/01/2024"},{"id":"569","buyPrice":61.06,"status":"vendu","addedAt":"01/01/2024"},{"id":"570","buyPrice":30.74,"status":"stock","addedAt":"01/01/2024"},{"id":"571","buyPrice":25.89,"status":"stock","addedAt":"01/01/2024"},{"id":"572","buyPrice":40.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"573","buyPrice":45.34,"status":"stock","addedAt":"01/01/2024"},{"id":"574","buyPrice":20.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"575","buyPrice":12.74,"status":"vendu","addedAt":"01/01/2024"},{"id":"576","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"577","buyPrice":12.74,"status":"vendu","addedAt":"01/01/2024"},{"id":"578","buyPrice":12.66,"status":"vendu","addedAt":"01/01/2024"},{"id":"579","buyPrice":20.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"580","buyPrice":14.28,"status":"stock","addedAt":"01/01/2024"},{"id":"581","buyPrice":10.18,"status":"stock","addedAt":"01/01/2024"},{"id":"582","buyPrice":15.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"583","buyPrice":18.45,"status":"stock","addedAt":"01/01/2024"},{"id":"584","buyPrice":38.31,"status":"stock","addedAt":"01/01/2024"},{"id":"585","buyPrice":21.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"586","buyPrice":19.73,"status":"vendu","addedAt":"01/01/2024"},{"id":"587","buyPrice":23.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"588","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"589","buyPrice":8.1,"status":"vendu","addedAt":"01/01/2024"},{"id":"590","buyPrice":31.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"591","buyPrice":21.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"592","buyPrice":13.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"593","buyPrice":18.57,"status":"vendu","addedAt":"01/01/2024"},{"id":"594","buyPrice":1.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"595","buyPrice":24.7,"status":"stock","addedAt":"01/01/2024"},{"id":"596","buyPrice":32.73,"status":"stock","addedAt":"01/01/2024"},{"id":"597","buyPrice":21.24,"status":"stock","addedAt":"01/01/2024"},{"id":"598","buyPrice":25.81,"status":"stock","addedAt":"01/01/2024"},{"id":"599","buyPrice":15.09,"status":"stock","addedAt":"01/01/2024"},{"id":"600","buyPrice":0.0,"status":"stock","addedAt":"01/01/2024"},{"id":"601","buyPrice":24.98,"status":"stock","addedAt":"01/01/2024"},{"id":"602","buyPrice":56.45,"status":"vendu","addedAt":"01/01/2024"},{"id":"603","buyPrice":15.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"604","buyPrice":19.44,"status":"stock","addedAt":"01/01/2024"},{"id":"605","buyPrice":15.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"606","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"607","buyPrice":21.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"608","buyPrice":14.28,"status":"vendu","addedAt":"01/01/2024"},{"id":"609","buyPrice":16.17,"status":"stock","addedAt":"01/01/2024"},{"id":"610","buyPrice":19.56,"status":"vendu","addedAt":"01/01/2024"},{"id":"611","buyPrice":25.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"612","buyPrice":14.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"613","buyPrice":19.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"614","buyPrice":15.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"615","buyPrice":15.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"616","buyPrice":31.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"617","buyPrice":20.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"618","buyPrice":19.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"619","buyPrice":9.74,"status":"vendu","addedAt":"01/01/2024"},{"id":"620","buyPrice":5.8,"status":"stock","addedAt":"01/01/2024"},{"id":"621","buyPrice":26.85,"status":"vendu","addedAt":"01/01/2024"},{"id":"622","buyPrice":9.07,"status":"stock","addedAt":"01/01/2024"},{"id":"623","buyPrice":17.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"624","buyPrice":5.8,"status":"vendu","addedAt":"01/01/2024"},{"id":"625","buyPrice":34.71,"status":"vendu","addedAt":"01/01/2024"},{"id":"626","buyPrice":37.32,"status":"stock","addedAt":"01/01/2024"},{"id":"627","buyPrice":19.45,"status":"vendu","addedAt":"01/01/2024"},{"id":"628","buyPrice":25.21,"status":"vendu","addedAt":"01/01/2024"},{"id":"629","buyPrice":19.56,"status":"vendu","addedAt":"01/01/2024"},{"id":"630","buyPrice":15.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"631","buyPrice":23.65,"status":"stock","addedAt":"01/01/2024"},{"id":"632","buyPrice":9.58,"status":"vendu","addedAt":"01/01/2024"},{"id":"633","buyPrice":23.46,"status":"vendu","addedAt":"01/01/2024"},{"id":"634","buyPrice":34.92,"status":"vendu","addedAt":"01/01/2024"},{"id":"635","buyPrice":15.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"636","buyPrice":20.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"637","buyPrice":11.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"638","buyPrice":8.94,"status":"vendu","addedAt":"01/01/2024"},{"id":"639","buyPrice":9.64,"status":"stock","addedAt":"01/01/2024"},{"id":"640","buyPrice":9.64,"status":"vendu","addedAt":"01/01/2024"},{"id":"641","buyPrice":9.64,"status":"vendu","addedAt":"01/01/2024"},{"id":"642","buyPrice":26.89,"status":"stock","addedAt":"01/01/2024"},{"id":"643","buyPrice":25.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"644","buyPrice":20.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"645","buyPrice":23.72,"status":"vendu","addedAt":"01/01/2024"},{"id":"646","buyPrice":20.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"647","buyPrice":21.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"648","buyPrice":14.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"649","buyPrice":8.67,"status":"vendu","addedAt":"01/01/2024"},{"id":"650","buyPrice":13.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"651","buyPrice":34.92,"status":"vendu","addedAt":"01/01/2024"},{"id":"652","buyPrice":29.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"653","buyPrice":14.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"654","buyPrice":17.47,"status":"stock","addedAt":"01/01/2024"},{"id":"655","buyPrice":17.47,"status":"vendu","addedAt":"01/01/2024"},{"id":"656","buyPrice":22.68,"status":"vendu","addedAt":"01/01/2024"},{"id":"657","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"658","buyPrice":24.7,"status":"stock","addedAt":"01/01/2024"},{"id":"659","buyPrice":56.56,"status":"vendu","addedAt":"01/01/2024"},{"id":"660","buyPrice":19.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"661","buyPrice":20.53,"status":"vendu","addedAt":"01/01/2024"},{"id":"662","buyPrice":26.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"663","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"664","buyPrice":25.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"665","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"666","buyPrice":24.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"667","buyPrice":13.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"668","buyPrice":20.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"669","buyPrice":25.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"670","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"671","buyPrice":20.63,"status":"vendu","addedAt":"01/01/2024"},{"id":"672","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"673","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"674","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"675","buyPrice":14.28,"status":"stock","addedAt":"01/01/2024"},{"id":"676","buyPrice":19.73,"status":"vendu","addedAt":"01/01/2024"},{"id":"677","buyPrice":26.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"678","buyPrice":14.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"679","buyPrice":6.35,"status":"stock","addedAt":"01/01/2024"},{"id":"680","buyPrice":7.32,"status":"stock","addedAt":"01/01/2024"},{"id":"681","buyPrice":13.05,"status":"stock","addedAt":"01/01/2024"},{"id":"682","buyPrice":42.82,"status":"stock","addedAt":"01/01/2024"},{"id":"683","buyPrice":0.0,"status":"stock","addedAt":"01/01/2024"},{"id":"684","buyPrice":10.18,"status":"vendu","addedAt":"01/01/2024"},{"id":"685","buyPrice":22.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"686","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"687","buyPrice":16.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"688","buyPrice":20.23,"status":"stock","addedAt":"01/01/2024"},{"id":"689","buyPrice":14.09,"status":"stock","addedAt":"01/01/2024"},{"id":"690","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"691","buyPrice":6.35,"status":"vendu","addedAt":"01/01/2024"},{"id":"692","buyPrice":9.68,"status":"vendu","addedAt":"01/01/2024"},{"id":"693","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"694","buyPrice":30.97,"status":"vendu","addedAt":"01/01/2024"},{"id":"695","buyPrice":31.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"696","buyPrice":16.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"697","buyPrice":26.91,"status":"vendu","addedAt":"01/01/2024"},{"id":"698","buyPrice":11.2,"status":"stock","addedAt":"01/01/2024"},{"id":"699","buyPrice":12.84,"status":"stock","addedAt":"01/01/2024"},{"id":"700","buyPrice":31.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"701","buyPrice":13.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"702","buyPrice":19.49,"status":"stock","addedAt":"01/01/2024"},{"id":"703","buyPrice":27.05,"status":"vendu","addedAt":"01/01/2024"},{"id":"704","buyPrice":10.4,"status":"vendu","addedAt":"01/01/2024"},{"id":"705","buyPrice":10.4,"status":"vendu","addedAt":"01/01/2024"},{"id":"706","buyPrice":10.4,"status":"vendu","addedAt":"01/01/2024"},{"id":"707","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"708","buyPrice":42.43,"status":"vendu","addedAt":"01/01/2024"},{"id":"709","buyPrice":14.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"710","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"711","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"712","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"713","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"714","buyPrice":30.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"715","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"716","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"717","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"718","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"719","buyPrice":11.5,"status":"stock","addedAt":"01/01/2024"},{"id":"720","buyPrice":36.42,"status":"vendu","addedAt":"01/01/2024"},{"id":"721","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"722","buyPrice":25.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"723","buyPrice":10.96,"status":"stock","addedAt":"01/01/2024"},{"id":"724","buyPrice":24.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"725","buyPrice":26.92,"status":"vendu","addedAt":"01/01/2024"},{"id":"726","buyPrice":17.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"727","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"728","buyPrice":25.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"729","buyPrice":21.57,"status":"stock","addedAt":"01/01/2024"},{"id":"730","buyPrice":14.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"731","buyPrice":16.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"732","buyPrice":14.28,"status":"vendu","addedAt":"01/01/2024"},{"id":"733","buyPrice":25.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"734","buyPrice":25.81,"status":"stock","addedAt":"01/01/2024"},{"id":"735","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"736","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"737","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"738","buyPrice":24.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"739","buyPrice":24.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"740","buyPrice":24.3,"status":"stock","addedAt":"01/01/2024"},{"id":"741","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"742","buyPrice":21.6,"status":"stock","addedAt":"01/01/2024"},{"id":"743","buyPrice":24.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"744","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"745","buyPrice":10.72,"status":"vendu","addedAt":"01/01/2024"},{"id":"746","buyPrice":8.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"747","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"748","buyPrice":14.09,"status":"stock","addedAt":"01/01/2024"},{"id":"749","buyPrice":17.0,"status":"stock","addedAt":"01/01/2024"},{"id":"750","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"751","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"752","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"753","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"754","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"755","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"756","buyPrice":29.29,"status":"stock","addedAt":"01/01/2024"},{"id":"757","buyPrice":56.46,"status":"stock","addedAt":"01/01/2024"},{"id":"758","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"759","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"760","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"761","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"762","buyPrice":25.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"763","buyPrice":13.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"764","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"765","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"766","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"767","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"768","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"769","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"770","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"771","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"772","buyPrice":14.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"773","buyPrice":24.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"774","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"775","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"776","buyPrice":26.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"777","buyPrice":22.68,"status":"stock","addedAt":"01/01/2024"},{"id":"778","buyPrice":13.26,"status":"stock","addedAt":"01/01/2024"},{"id":"779","buyPrice":14.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"780","buyPrice":20.4,"status":"vendu","addedAt":"01/01/2024"},{"id":"781","buyPrice":31.83,"status":"stock","addedAt":"01/01/2024"},{"id":"782","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"783","buyPrice":16.69,"status":"stock","addedAt":"01/01/2024"},{"id":"784","buyPrice":24.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"785","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"786","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"787","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"788","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"789","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"790","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"791","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"792","buyPrice":24.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"793","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"794","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"795","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"796","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"797","buyPrice":24.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"798","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"799","buyPrice":35.72,"status":"vendu","addedAt":"01/01/2024"},{"id":"800","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"801","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"802","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"803","buyPrice":15.39,"status":"stock","addedAt":"01/01/2024"},{"id":"804","buyPrice":14.28,"status":"vendu","addedAt":"01/01/2024"},{"id":"805","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"806","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"807","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"808","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"809","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"810","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"811","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"812","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"813","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"814","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"815","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"816","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"817","buyPrice":24.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"818","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"819","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"820","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"821","buyPrice":11.41,"status":"vendu","addedAt":"01/01/2024"},{"id":"822","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"823","buyPrice":21.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"824","buyPrice":25.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"825","buyPrice":19.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"826","buyPrice":30.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"827","buyPrice":23.8,"status":"vendu","addedAt":"01/01/2024"},{"id":"828","buyPrice":21.57,"status":"vendu","addedAt":"01/01/2024"},{"id":"829","buyPrice":24.7,"status":"stock","addedAt":"01/01/2024"},{"id":"830","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"831","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"832","buyPrice":24.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"833","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"834","buyPrice":24.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"835","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"836","buyPrice":16.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"837","buyPrice":14.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"838","buyPrice":20.56,"status":"vendu","addedAt":"01/01/2024"},{"id":"839","buyPrice":13.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"840","buyPrice":8.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"841","buyPrice":10.45,"status":"vendu","addedAt":"01/01/2024"},{"id":"842","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"843","buyPrice":21.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"844","buyPrice":10.45,"status":"vendu","addedAt":"01/01/2024"},{"id":"845","buyPrice":24.41,"status":"vendu","addedAt":"01/01/2024"},{"id":"846","buyPrice":25.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"847","buyPrice":1.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"848","buyPrice":26.91,"status":"stock","addedAt":"01/01/2024"},{"id":"849","buyPrice":22.0,"status":"stock","addedAt":"01/01/2024"},{"id":"850","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"851","buyPrice":26.81,"status":"stock","addedAt":"01/01/2024"},{"id":"852","buyPrice":11.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"853","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"854","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"855","buyPrice":23.99,"status":"stock","addedAt":"01/01/2024"},{"id":"856","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"857","buyPrice":29.01,"status":"stock","addedAt":"01/01/2024"},{"id":"858","buyPrice":10.45,"status":"vendu","addedAt":"01/01/2024"},{"id":"859","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"860","buyPrice":31.41,"status":"vendu","addedAt":"01/01/2024"},{"id":"861","buyPrice":16.09,"status":"stock","addedAt":"01/01/2024"},{"id":"862","buyPrice":8.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"863","buyPrice":29.9,"status":"vendu","addedAt":"01/01/2024"},{"id":"864","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"865","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"866","buyPrice":8.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"867","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"868","buyPrice":23.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"869","buyPrice":22.1,"status":"vendu","addedAt":"01/01/2024"},{"id":"870","buyPrice":25.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"871","buyPrice":24.67,"status":"vendu","addedAt":"01/01/2024"},{"id":"872","buyPrice":19.49,"status":"stock","addedAt":"01/01/2024"},{"id":"873","buyPrice":24.76,"status":"vendu","addedAt":"01/01/2024"},{"id":"874","buyPrice":17.47,"status":"stock","addedAt":"01/01/2024"},{"id":"875","buyPrice":15.96,"status":"vendu","addedAt":"01/01/2024"},{"id":"876","buyPrice":15.96,"status":"vendu","addedAt":"01/01/2024"},{"id":"877","buyPrice":8.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"878","buyPrice":25.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"879","buyPrice":22.61,"status":"vendu","addedAt":"01/01/2024"},{"id":"880","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"881","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"882","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"883","buyPrice":16.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"884","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"885","buyPrice":26.81,"status":"stock","addedAt":"01/01/2024"},{"id":"886","buyPrice":24.3,"status":"stock","addedAt":"01/01/2024"},{"id":"887","buyPrice":17.19,"status":"stock","addedAt":"01/01/2024"},{"id":"888","buyPrice":20.24,"status":"stock","addedAt":"01/01/2024"},{"id":"889","buyPrice":20.6,"status":"stock","addedAt":"01/01/2024"},{"id":"890","buyPrice":12.99,"status":"stock","addedAt":"01/01/2024"},{"id":"891","buyPrice":26.91,"status":"stock","addedAt":"01/01/2024"},{"id":"892","buyPrice":20.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"893","buyPrice":16.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"894","buyPrice":20.2,"status":"stock","addedAt":"01/01/2024"},{"id":"895","buyPrice":30.4,"status":"vendu","addedAt":"01/01/2024"},{"id":"896","buyPrice":21.42,"status":"vendu","addedAt":"01/01/2024"},{"id":"897","buyPrice":35.72,"status":"vendu","addedAt":"01/01/2024"},{"id":"898","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"899","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"900","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"901","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"902","buyPrice":12.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"903","buyPrice":21.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"904","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"905","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"906","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"907","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"908","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"909","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"910","buyPrice":12.08,"status":"stock","addedAt":"01/01/2024"},{"id":"911","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"912","buyPrice":24.98,"status":"vendu","addedAt":"01/01/2024"},{"id":"913","buyPrice":16.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"914","buyPrice":21.7,"status":"stock","addedAt":"01/01/2024"},{"id":"915","buyPrice":16.59,"status":"stock","addedAt":"01/01/2024"},{"id":"916","buyPrice":30.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"917","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"918","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"919","buyPrice":26.81,"status":"stock","addedAt":"01/01/2024"},{"id":"920","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"921","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"922","buyPrice":22.61,"status":"vendu","addedAt":"01/01/2024"},{"id":"923","buyPrice":21.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"924","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"925","buyPrice":25.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"926","buyPrice":26.21,"status":"vendu","addedAt":"01/01/2024"},{"id":"927","buyPrice":16.36,"status":"vendu","addedAt":"01/01/2024"},{"id":"928","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"929","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"930","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"931","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"932","buyPrice":26.81,"status":"stock","addedAt":"01/01/2024"},{"id":"933","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"934","buyPrice":26.81,"status":"stock","addedAt":"01/01/2024"},{"id":"935","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"936","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"937","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"938","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"939","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"940","buyPrice":29.9,"status":"vendu","addedAt":"01/01/2024"},{"id":"941","buyPrice":26.81,"status":"stock","addedAt":"01/01/2024"},{"id":"942","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"943","buyPrice":53.32,"status":"vendu","addedAt":"01/01/2024"},{"id":"944","buyPrice":22.68,"status":"vendu","addedAt":"01/01/2024"},{"id":"945","buyPrice":19.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"946","buyPrice":26.81,"status":"stock","addedAt":"01/01/2024"},{"id":"947","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"948","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"949","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"950","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"951","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"952","buyPrice":26.81,"status":"stock","addedAt":"01/01/2024"},{"id":"953","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"954","buyPrice":16.39,"status":"stock","addedAt":"01/01/2024"},{"id":"955","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"956","buyPrice":26.41,"status":"vendu","addedAt":"01/01/2024"},{"id":"957","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"958","buyPrice":24.12,"status":"vendu","addedAt":"01/01/2024"},{"id":"959","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"960","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"961","buyPrice":15.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"962","buyPrice":22.61,"status":"stock","addedAt":"01/01/2024"},{"id":"963","buyPrice":7.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"964","buyPrice":14.28,"status":"vendu","addedAt":"01/01/2024"},{"id":"965","buyPrice":21.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"966","buyPrice":30.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"967","buyPrice":16.87,"status":"vendu","addedAt":"01/01/2024"},{"id":"968","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"969","buyPrice":24.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"970","buyPrice":16.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"971","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"972","buyPrice":11.22,"status":"vendu","addedAt":"01/01/2024"},{"id":"973","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"974","buyPrice":23.54,"status":"stock","addedAt":"01/01/2024"},{"id":"975","buyPrice":9.92,"status":"stock","addedAt":"01/01/2024"},{"id":"976","buyPrice":16.39,"status":"stock","addedAt":"01/01/2024"},{"id":"977","buyPrice":9.07,"status":"stock","addedAt":"01/01/2024"},{"id":"978","buyPrice":24.3,"status":"stock","addedAt":"01/01/2024"},{"id":"979","buyPrice":20.56,"status":"vendu","addedAt":"01/01/2024"},{"id":"980","buyPrice":14.28,"status":"stock","addedAt":"01/01/2024"},{"id":"981","buyPrice":17.47,"status":"vendu","addedAt":"01/01/2024"},{"id":"982","buyPrice":24.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"983","buyPrice":24.58,"status":"vendu","addedAt":"01/01/2024"},{"id":"984","buyPrice":21.91,"status":"vendu","addedAt":"01/01/2024"},{"id":"985","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"986","buyPrice":21.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"987","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"988","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"989","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"990","buyPrice":19.73,"status":"vendu","addedAt":"01/01/2024"},{"id":"991","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"992","buyPrice":23.94,"status":"stock","addedAt":"01/01/2024"},{"id":"993","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"994","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"995","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"996","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"997","buyPrice":17.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"998","buyPrice":23.68,"status":"vendu","addedAt":"01/01/2024"},{"id":"999","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"1000","buyPrice":22.61,"status":"vendu","addedAt":"01/01/2024"},{"id":"1001","buyPrice":23.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1002","buyPrice":25.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"1003","buyPrice":24.18,"status":"vendu","addedAt":"01/01/2024"},{"id":"1004","buyPrice":24.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1005","buyPrice":24.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"1006","buyPrice":20.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"1007","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1008","buyPrice":24.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1009","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1010","buyPrice":27.95,"status":"stock","addedAt":"01/01/2024"},{"id":"1011","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"1012","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1013","buyPrice":21.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"1014","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1015","buyPrice":16.97,"status":"vendu","addedAt":"01/01/2024"},{"id":"1016","buyPrice":20.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"1017","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1018","buyPrice":26.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"1019","buyPrice":16.36,"status":"vendu","addedAt":"01/01/2024"},{"id":"1020","buyPrice":26.92,"status":"stock","addedAt":"01/01/2024"},{"id":"1021","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1022","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1023","buyPrice":23.72,"status":"vendu","addedAt":"01/01/2024"},{"id":"1024","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1025","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1026","buyPrice":26.81,"status":"stock","addedAt":"01/01/2024"},{"id":"1027","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"1028","buyPrice":25.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"1029","buyPrice":21.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"1030","buyPrice":25.74,"status":"stock","addedAt":"01/01/2024"},{"id":"1031","buyPrice":20.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"1032","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1033","buyPrice":24.7,"status":"stock","addedAt":"01/01/2024"},{"id":"1034","buyPrice":24.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"1035","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1036","buyPrice":22.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1037","buyPrice":19.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"1038","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1039","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1040","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1041","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1042","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1043","buyPrice":10.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1044","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1045","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"1046","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1047","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"1048","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1049","buyPrice":22.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1050","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1051","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1052","buyPrice":14.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1053","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1054","buyPrice":24.04,"status":"vendu","addedAt":"01/01/2024"},{"id":"1055","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1056","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"1057","buyPrice":26.62,"status":"vendu","addedAt":"01/01/2024"},{"id":"1058","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1059","buyPrice":34.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1060","buyPrice":13.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"1061","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1062","buyPrice":24.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"1063","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"1064","buyPrice":45.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1065","buyPrice":35.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1066","buyPrice":37.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1067","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"1068","buyPrice":22.21,"status":"vendu","addedAt":"01/01/2024"},{"id":"1069","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1070","buyPrice":25.62,"status":"vendu","addedAt":"01/01/2024"},{"id":"1071","buyPrice":10.18,"status":"vendu","addedAt":"01/01/2024"},{"id":"1072","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1073","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1074","buyPrice":15.83,"status":"vendu","addedAt":"01/01/2024"},{"id":"1075","buyPrice":27.95,"status":"vendu","addedAt":"01/01/2024"},{"id":"1076","buyPrice":27.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"1077","buyPrice":26.91,"status":"stock","addedAt":"01/01/2024"},{"id":"1078","buyPrice":25.21,"status":"vendu","addedAt":"01/01/2024"},{"id":"1079","buyPrice":14.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"1080","buyPrice":14.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"1081","buyPrice":10.11,"status":"vendu","addedAt":"01/01/2024"},{"id":"1082","buyPrice":40.33,"status":"vendu","addedAt":"01/01/2024"},{"id":"1083","buyPrice":11.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1084","buyPrice":13.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"1085","buyPrice":26.91,"status":"vendu","addedAt":"01/01/2024"},{"id":"1086","buyPrice":8.8,"status":"stock","addedAt":"01/01/2024"},{"id":"1087","buyPrice":10.18,"status":"stock","addedAt":"01/01/2024"},{"id":"1088","buyPrice":18.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1089","buyPrice":24.04,"status":"stock","addedAt":"01/01/2024"},{"id":"1090","buyPrice":14.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"1091","buyPrice":20.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"1092","buyPrice":10.61,"status":"vendu","addedAt":"01/01/2024"},{"id":"1093","buyPrice":19.56,"status":"stock","addedAt":"01/01/2024"},{"id":"1094","buyPrice":26.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"1095","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1096","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1097","buyPrice":14.89,"status":"stock","addedAt":"01/01/2024"},{"id":"1098","buyPrice":17.47,"status":"vendu","addedAt":"01/01/2024"},{"id":"1099","buyPrice":16.45,"status":"stock","addedAt":"01/01/2024"},{"id":"1100","buyPrice":23.12,"status":"stock","addedAt":"01/01/2024"},{"id":"1101","buyPrice":20.84,"status":"stock","addedAt":"01/01/2024"},{"id":"1102","buyPrice":30.41,"status":"vendu","addedAt":"01/01/2024"},{"id":"1103","buyPrice":26.91,"status":"stock","addedAt":"01/01/2024"},{"id":"1104","buyPrice":9.07,"status":"vendu","addedAt":"01/01/2024"},{"id":"1105","buyPrice":14.28,"status":"vendu","addedAt":"01/01/2024"},{"id":"1106","buyPrice":21.7,"status":"stock","addedAt":"01/01/2024"},{"id":"1107","buyPrice":14.89,"status":"stock","addedAt":"01/01/2024"},{"id":"1108","buyPrice":8.1,"status":"vendu","addedAt":"01/01/2024"},{"id":"1109","buyPrice":25.21,"status":"stock","addedAt":"01/01/2024"},{"id":"1110","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1111","buyPrice":23.12,"status":"stock","addedAt":"01/01/2024"},{"id":"1112","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1113","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1114","buyPrice":26.91,"status":"vendu","addedAt":"01/01/2024"},{"id":"1115","buyPrice":16.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1116","buyPrice":5.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1117","buyPrice":25.62,"status":"stock","addedAt":"01/01/2024"},{"id":"1118","buyPrice":25.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"1119","buyPrice":17.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"1120","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1121","buyPrice":8.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1122","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1123","buyPrice":14.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"1124","buyPrice":14.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"1125","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"1126","buyPrice":10.96,"status":"vendu","addedAt":"01/01/2024"},{"id":"1127","buyPrice":26.91,"status":"vendu","addedAt":"01/01/2024"},{"id":"1128","buyPrice":9.68,"status":"vendu","addedAt":"01/01/2024"},{"id":"1129","buyPrice":15.59,"status":"stock","addedAt":"01/01/2024"},{"id":"1130","buyPrice":26.43,"status":"vendu","addedAt":"01/01/2024"},{"id":"1131","buyPrice":26.43,"status":"stock","addedAt":"01/01/2024"},{"id":"1132","buyPrice":17.44,"status":"stock","addedAt":"01/01/2024"},{"id":"1133","buyPrice":18.57,"status":"stock","addedAt":"01/01/2024"},{"id":"1134","buyPrice":32.2,"status":"stock","addedAt":"01/01/2024"},{"id":"1135","buyPrice":21.94,"status":"vendu","addedAt":"01/01/2024"},{"id":"1136","buyPrice":23.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1137","buyPrice":25.86,"status":"vendu","addedAt":"01/01/2024"},{"id":"1138","buyPrice":28.93,"status":"stock","addedAt":"01/01/2024"},{"id":"1139","buyPrice":32.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"1140","buyPrice":25.81,"status":"stock","addedAt":"01/01/2024"},{"id":"1141","buyPrice":9.2,"status":"stock","addedAt":"01/01/2024"},{"id":"1142","buyPrice":14.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"1143","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"1144","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1145","buyPrice":9.04,"status":"vendu","addedAt":"01/01/2024"},{"id":"1146","buyPrice":19.73,"status":"vendu","addedAt":"01/01/2024"},{"id":"1147","buyPrice":22.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1148","buyPrice":32.07,"status":"vendu","addedAt":"01/01/2024"},{"id":"1149","buyPrice":16.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"1150","buyPrice":22.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"1151","buyPrice":32.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1152","buyPrice":31.83,"status":"stock","addedAt":"01/01/2024"},{"id":"1153","buyPrice":33.48,"status":"stock","addedAt":"01/01/2024"},{"id":"1154","buyPrice":26.78,"status":"stock","addedAt":"01/01/2024"},{"id":"1155","buyPrice":24.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"1156","buyPrice":26.87,"status":"vendu","addedAt":"01/01/2024"},{"id":"1157","buyPrice":46.05,"status":"vendu","addedAt":"01/01/2024"},{"id":"1158","buyPrice":19.37,"status":"stock","addedAt":"01/01/2024"},{"id":"1159","buyPrice":11.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"1160","buyPrice":25.21,"status":"vendu","addedAt":"01/01/2024"},{"id":"1161","buyPrice":25.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"1162","buyPrice":16.45,"status":"vendu","addedAt":"01/01/2024"},{"id":"1163","buyPrice":10.34,"status":"stock","addedAt":"01/01/2024"},{"id":"1164","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"1165","buyPrice":26.87,"status":"vendu","addedAt":"01/01/2024"},{"id":"1166","buyPrice":28.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"1167","buyPrice":9.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"1168","buyPrice":25.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"1169","buyPrice":24.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"1170","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1171","buyPrice":25.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"1172","buyPrice":11.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1173","buyPrice":11.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1174","buyPrice":11.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1175","buyPrice":11.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1176","buyPrice":24.04,"status":"stock","addedAt":"01/01/2024"},{"id":"1177","buyPrice":10.89,"status":"stock","addedAt":"01/01/2024"},{"id":"1178","buyPrice":15.59,"status":"stock","addedAt":"01/01/2024"},{"id":"1179","buyPrice":20.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"1180","buyPrice":7.87,"status":"vendu","addedAt":"01/01/2024"},{"id":"1181","buyPrice":24.51,"status":"stock","addedAt":"01/01/2024"},{"id":"1182","buyPrice":26.07,"status":"vendu","addedAt":"01/01/2024"},{"id":"1183","buyPrice":35.08,"status":"vendu","addedAt":"01/01/2024"},{"id":"1184","buyPrice":26.87,"status":"stock","addedAt":"01/01/2024"},{"id":"1185","buyPrice":36.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"1186","buyPrice":26.95,"status":"vendu","addedAt":"01/01/2024"},{"id":"1187","buyPrice":9.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"1188","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1189","buyPrice":27.17,"status":"stock","addedAt":"01/01/2024"},{"id":"1190","buyPrice":26.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1191","buyPrice":30.1,"status":"vendu","addedAt":"01/01/2024"},{"id":"1192","buyPrice":17.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1193","buyPrice":24.7,"status":"stock","addedAt":"01/01/2024"},{"id":"1194","buyPrice":21.9,"status":"stock","addedAt":"01/01/2024"},{"id":"1195","buyPrice":10.62,"status":"vendu","addedAt":"01/01/2024"},{"id":"1196","buyPrice":21.38,"status":"vendu","addedAt":"01/01/2024"},{"id":"1197","buyPrice":16.69,"status":"stock","addedAt":"01/01/2024"},{"id":"1198","buyPrice":11.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1199","buyPrice":11.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1200","buyPrice":15.41,"status":"vendu","addedAt":"01/01/2024"},{"id":"1201","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1202","buyPrice":14.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1203","buyPrice":22.68,"status":"vendu","addedAt":"01/01/2024"},{"id":"1204","buyPrice":11.67,"status":"stock","addedAt":"01/01/2024"},{"id":"1205","buyPrice":19.3,"status":"stock","addedAt":"01/01/2024"},{"id":"1206","buyPrice":30.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"1207","buyPrice":20.34,"status":"stock","addedAt":"01/01/2024"},{"id":"1208","buyPrice":26.78,"status":"vendu","addedAt":"01/01/2024"},{"id":"1209","buyPrice":31.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"1210","buyPrice":27.19,"status":"stock","addedAt":"01/01/2024"},{"id":"1211","buyPrice":35.11,"status":"stock","addedAt":"01/01/2024"},{"id":"1212","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1213","buyPrice":18.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1214","buyPrice":19.33,"status":"vendu","addedAt":"01/01/2024"},{"id":"1215","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1216","buyPrice":29.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"1217","buyPrice":16.36,"status":"stock","addedAt":"01/01/2024"},{"id":"1218","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1219","buyPrice":25.34,"status":"vendu","addedAt":"01/01/2024"},{"id":"1220","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1221","buyPrice":19.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"1222","buyPrice":26.87,"status":"vendu","addedAt":"01/01/2024"},{"id":"1223","buyPrice":9.23,"status":"stock","addedAt":"01/01/2024"},{"id":"1224","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1225","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"1226","buyPrice":16.06,"status":"stock","addedAt":"01/01/2024"},{"id":"1227","buyPrice":16.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"1228","buyPrice":21.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1229","buyPrice":21.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1230","buyPrice":17.47,"status":"stock","addedAt":"01/01/2024"},{"id":"1231","buyPrice":24.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1232","buyPrice":14.28,"status":"stock","addedAt":"01/01/2024"},{"id":"1233","buyPrice":20.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"1234","buyPrice":23.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1235","buyPrice":23.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1236","buyPrice":22.08,"status":"stock","addedAt":"01/01/2024"},{"id":"1237","buyPrice":24.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1238","buyPrice":13.32,"status":"vendu","addedAt":"01/01/2024"},{"id":"1239","buyPrice":12.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1240","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1241","buyPrice":24.41,"status":"vendu","addedAt":"01/01/2024"},{"id":"1242","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1243","buyPrice":11.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"1244","buyPrice":11.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1245","buyPrice":16.45,"status":"vendu","addedAt":"01/01/2024"},{"id":"1246","buyPrice":11.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1247","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1248","buyPrice":24.51,"status":"vendu","addedAt":"01/01/2024"},{"id":"1249","buyPrice":19.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"1250","buyPrice":19.49,"status":"stock","addedAt":"01/01/2024"},{"id":"1251","buyPrice":11.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"1252","buyPrice":10.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"1253","buyPrice":16.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"1254","buyPrice":19.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1255","buyPrice":10.86,"status":"vendu","addedAt":"01/01/2024"},{"id":"1256","buyPrice":26.29,"status":"stock","addedAt":"01/01/2024"},{"id":"1257","buyPrice":23.74,"status":"vendu","addedAt":"01/01/2024"},{"id":"1258","buyPrice":12.95,"status":"vendu","addedAt":"01/01/2024"},{"id":"1259","buyPrice":8.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"1260","buyPrice":16.49,"status":"stock","addedAt":"01/01/2024"},{"id":"1261","buyPrice":8.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1262","buyPrice":12.2,"status":"stock","addedAt":"01/01/2024"},{"id":"1263","buyPrice":19.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1264","buyPrice":21.66,"status":"stock","addedAt":"01/01/2024"},{"id":"1265","buyPrice":15.39,"status":"stock","addedAt":"01/01/2024"},{"id":"1266","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1267","buyPrice":14.16,"status":"vendu","addedAt":"01/01/2024"},{"id":"1268","buyPrice":11.8,"status":"stock","addedAt":"01/01/2024"},{"id":"1269","buyPrice":27.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"1270","buyPrice":7.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1271","buyPrice":16.55,"status":"vendu","addedAt":"01/01/2024"},{"id":"1272","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"1273","buyPrice":12.56,"status":"vendu","addedAt":"01/01/2024"},{"id":"1274","buyPrice":22.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1275","buyPrice":11.8,"status":"vendu","addedAt":"01/01/2024"},{"id":"1276","buyPrice":24.76,"status":"stock","addedAt":"01/01/2024"},{"id":"1277","buyPrice":8.12,"status":"vendu","addedAt":"01/01/2024"},{"id":"1278","buyPrice":7.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1279","buyPrice":9.92,"status":"vendu","addedAt":"01/01/2024"},{"id":"1280","buyPrice":18.53,"status":"vendu","addedAt":"01/01/2024"},{"id":"1281","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"1282","buyPrice":8.36,"status":"vendu","addedAt":"01/01/2024"},{"id":"1283","buyPrice":13.88,"status":"stock","addedAt":"01/01/2024"},{"id":"1284","buyPrice":24.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"1285","buyPrice":20.6,"status":"stock","addedAt":"01/01/2024"},{"id":"1286","buyPrice":12.89,"status":"stock","addedAt":"01/01/2024"},{"id":"1287","buyPrice":7.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"1288","buyPrice":7.2,"status":"stock","addedAt":"01/01/2024"},{"id":"1289","buyPrice":6.08,"status":"vendu","addedAt":"01/01/2024"},{"id":"1290","buyPrice":21.76,"status":"stock","addedAt":"01/01/2024"},{"id":"1291","buyPrice":12.1,"status":"stock","addedAt":"01/01/2024"},{"id":"1292","buyPrice":9.22,"status":"vendu","addedAt":"01/01/2024"},{"id":"1293","buyPrice":26.85,"status":"vendu","addedAt":"01/01/2024"},{"id":"1294","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"1295","buyPrice":7.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1296","buyPrice":7.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1297","buyPrice":7.5,"status":"stock","addedAt":"01/01/2024"},{"id":"1298","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1299","buyPrice":10.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1300","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1301","buyPrice":10.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1302","buyPrice":24.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1303","buyPrice":13.36,"status":"stock","addedAt":"01/01/2024"},{"id":"1304","buyPrice":13.24,"status":"stock","addedAt":"01/01/2024"},{"id":"1305","buyPrice":8.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"1306","buyPrice":15.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"1307","buyPrice":25.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"1308","buyPrice":36.59,"status":"stock","addedAt":"01/01/2024"},{"id":"1309","buyPrice":15.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1310","buyPrice":9.07,"status":"vendu","addedAt":"01/01/2024"},{"id":"1311","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"1312","buyPrice":15.59,"status":"stock","addedAt":"01/01/2024"},{"id":"1313","buyPrice":12.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"1314","buyPrice":21.94,"status":"vendu","addedAt":"01/01/2024"},{"id":"1315","buyPrice":21.9,"status":"stock","addedAt":"01/01/2024"},{"id":"1316","buyPrice":10.64,"status":"stock","addedAt":"01/01/2024"},{"id":"1317","buyPrice":18.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"1318","buyPrice":27.71,"status":"vendu","addedAt":"01/01/2024"},{"id":"1319","buyPrice":15.65,"status":"vendu","addedAt":"01/01/2024"},{"id":"1320","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1321","buyPrice":25.31,"status":"stock","addedAt":"01/01/2024"},{"id":"1322","buyPrice":19.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"1323","buyPrice":16.16,"status":"stock","addedAt":"01/01/2024"},{"id":"1324","buyPrice":10.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1325","buyPrice":22.21,"status":"vendu","addedAt":"01/01/2024"},{"id":"1326","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"1327","buyPrice":19.73,"status":"vendu","addedAt":"01/01/2024"},{"id":"1328","buyPrice":14.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1329","buyPrice":17.35,"status":"stock","addedAt":"01/01/2024"},{"id":"1330","buyPrice":15.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"1331","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"1332","buyPrice":17.69,"status":"stock","addedAt":"01/01/2024"},{"id":"1333","buyPrice":14.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"1334","buyPrice":27.19,"status":"stock","addedAt":"01/01/2024"},{"id":"1335","buyPrice":20.8,"status":"stock","addedAt":"01/01/2024"},{"id":"1336","buyPrice":24.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"1337","buyPrice":18.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"1338","buyPrice":9.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"1339","buyPrice":19.33,"status":"vendu","addedAt":"01/01/2024"},{"id":"1340","buyPrice":29.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1341","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"1342","buyPrice":17.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"1343","buyPrice":14.1,"status":"stock","addedAt":"01/01/2024"},{"id":"1344","buyPrice":14.1,"status":"vendu","addedAt":"01/01/2024"},{"id":"1345","buyPrice":14.58,"status":"stock","addedAt":"01/01/2024"},{"id":"1346","buyPrice":24.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"1347","buyPrice":21.9,"status":"vendu","addedAt":"01/01/2024"},{"id":"1348","buyPrice":11.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1349","buyPrice":25.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"1350","buyPrice":22.88,"status":"vendu","addedAt":"01/01/2024"},{"id":"1351","buyPrice":10.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"1352","buyPrice":16.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"1353","buyPrice":24.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"1354","buyPrice":9.71,"status":"vendu","addedAt":"01/01/2024"},{"id":"1355","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1356","buyPrice":23.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1357","buyPrice":14.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"1358","buyPrice":14.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"1359","buyPrice":9.23,"status":"stock","addedAt":"01/01/2024"},{"id":"1360","buyPrice":15.39,"status":"stock","addedAt":"01/01/2024"},{"id":"1361","buyPrice":15.39,"status":"stock","addedAt":"01/01/2024"},{"id":"1362","buyPrice":14.08,"status":"vendu","addedAt":"01/01/2024"},{"id":"1363","buyPrice":26.87,"status":"vendu","addedAt":"01/01/2024"},{"id":"1364","buyPrice":21.9,"status":"vendu","addedAt":"01/01/2024"},{"id":"1365","buyPrice":29.41,"status":"vendu","addedAt":"01/01/2024"},{"id":"1366","buyPrice":11.67,"status":"stock","addedAt":"01/01/2024"},{"id":"1367","buyPrice":16.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"1368","buyPrice":10.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"1369","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1370","buyPrice":20.84,"status":"stock","addedAt":"01/01/2024"},{"id":"1371","buyPrice":19.54,"status":"stock","addedAt":"01/01/2024"},{"id":"1372","buyPrice":23.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"1373","buyPrice":13.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"1374","buyPrice":26.05,"status":"vendu","addedAt":"01/01/2024"},{"id":"1375","buyPrice":13.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1376","buyPrice":31.34,"status":"stock","addedAt":"01/01/2024"},{"id":"1377","buyPrice":21.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1378","buyPrice":9.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1379","buyPrice":14.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1380","buyPrice":14.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"1381","buyPrice":15.55,"status":"stock","addedAt":"01/01/2024"},{"id":"1382","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"1383","buyPrice":11.94,"status":"vendu","addedAt":"01/01/2024"},{"id":"1384","buyPrice":42.59,"status":"stock","addedAt":"01/01/2024"},{"id":"1385","buyPrice":18.35,"status":"vendu","addedAt":"01/01/2024"},{"id":"1386","buyPrice":14.48,"status":"stock","addedAt":"01/01/2024"},{"id":"1387","buyPrice":21.64,"status":"stock","addedAt":"01/01/2024"},{"id":"1388","buyPrice":15.55,"status":"vendu","addedAt":"01/01/2024"},{"id":"1389","buyPrice":15.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"1390","buyPrice":17.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1391","buyPrice":10.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"1392","buyPrice":21.57,"status":"vendu","addedAt":"01/01/2024"},{"id":"1393","buyPrice":15.33,"status":"vendu","addedAt":"01/01/2024"},{"id":"1394","buyPrice":17.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1395","buyPrice":19.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"1396","buyPrice":15.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"1397","buyPrice":10.87,"status":"stock","addedAt":"01/01/2024"},{"id":"1398","buyPrice":19.78,"status":"vendu","addedAt":"01/01/2024"},{"id":"1399","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1400","buyPrice":30.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1401","buyPrice":15.85,"status":"vendu","addedAt":"01/01/2024"},{"id":"1402","buyPrice":14.99,"status":"stock","addedAt":"01/01/2024"},{"id":"1403","buyPrice":14.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"1404","buyPrice":25.31,"status":"vendu","addedAt":"01/01/2024"},{"id":"1405","buyPrice":22.11,"status":"vendu","addedAt":"01/01/2024"},{"id":"1406","buyPrice":19.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"1407","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"1408","buyPrice":46.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"1409","buyPrice":8.65,"status":"vendu","addedAt":"01/01/2024"},{"id":"1410","buyPrice":11.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1411","buyPrice":11.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1412","buyPrice":14.19,"status":"vendu","addedAt":"01/01/2024"},{"id":"1413","buyPrice":14.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"1414","buyPrice":14.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"1415","buyPrice":17.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"1416","buyPrice":22.42,"status":"vendu","addedAt":"01/01/2024"},{"id":"1417","buyPrice":15.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"1418","buyPrice":11.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1419","buyPrice":11.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1420","buyPrice":14.08,"status":"vendu","addedAt":"01/01/2024"},{"id":"1421","buyPrice":22.7,"status":"vendu","addedAt":"01/01/2024"},{"id":"1422","buyPrice":14.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1423","buyPrice":14.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1424","buyPrice":14.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"1425","buyPrice":12.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"1426","buyPrice":8.93,"status":"vendu","addedAt":"01/01/2024"},{"id":"1427","buyPrice":17.9,"status":"vendu","addedAt":"01/01/2024"},{"id":"1428","buyPrice":15.5,"status":"stock","addedAt":"01/01/2024"},{"id":"1429","buyPrice":15.96,"status":"vendu","addedAt":"01/01/2024"},{"id":"1430","buyPrice":19.33,"status":"vendu","addedAt":"01/01/2024"},{"id":"1431","buyPrice":20.23,"status":"stock","addedAt":"01/01/2024"},{"id":"1432","buyPrice":17.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1433","buyPrice":16.36,"status":"vendu","addedAt":"01/01/2024"},{"id":"1434","buyPrice":17.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1435","buyPrice":19.73,"status":"stock","addedAt":"01/01/2024"},{"id":"1436","buyPrice":12.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"1437","buyPrice":24.44,"status":"vendu","addedAt":"01/01/2024"},{"id":"1438","buyPrice":12.29,"status":"stock","addedAt":"01/01/2024"},{"id":"1439","buyPrice":16.65,"status":"stock","addedAt":"01/01/2024"},{"id":"1440","buyPrice":15.65,"status":"vendu","addedAt":"01/01/2024"},{"id":"1441","buyPrice":14.28,"status":"vendu","addedAt":"01/01/2024"},{"id":"1442","buyPrice":23.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"1443","buyPrice":9.07,"status":"vendu","addedAt":"01/01/2024"},{"id":"1444","buyPrice":11.67,"status":"vendu","addedAt":"01/01/2024"},{"id":"1445","buyPrice":16.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1446","buyPrice":18.79,"status":"vendu","addedAt":"01/01/2024"},{"id":"1447","buyPrice":47.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1448","buyPrice":21.9,"status":"vendu","addedAt":"01/01/2024"},{"id":"1449","buyPrice":27.42,"status":"vendu","addedAt":"01/01/2024"},{"id":"1450","buyPrice":20.24,"status":"vendu","addedAt":"01/01/2024"},{"id":"1451","buyPrice":15.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"1452","buyPrice":23.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1453","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1454","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1455","buyPrice":24.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"1456","buyPrice":16.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1457","buyPrice":24.42,"status":"vendu","addedAt":"01/01/2024"},{"id":"1458","buyPrice":16.45,"status":"stock","addedAt":"01/01/2024"},{"id":"1459","buyPrice":20.6,"status":"vendu","addedAt":"01/01/2024"},{"id":"1460","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"1461","buyPrice":20.12,"status":"vendu","addedAt":"01/01/2024"},{"id":"1462","buyPrice":15.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"1463","buyPrice":13.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"1464","buyPrice":22.07,"status":"stock","addedAt":"01/01/2024"},{"id":"1465","buyPrice":16.45,"status":"vendu","addedAt":"01/01/2024"},{"id":"1466","buyPrice":16.58,"status":"vendu","addedAt":"01/01/2024"},{"id":"1467","buyPrice":10.84,"status":"vendu","addedAt":"01/01/2024"},{"id":"1468","buyPrice":8.58,"status":"vendu","addedAt":"01/01/2024"},{"id":"1469","buyPrice":9.74,"status":"vendu","addedAt":"01/01/2024"},{"id":"1470","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1471","buyPrice":24.7,"status":"stock","addedAt":"01/01/2024"},{"id":"1472","buyPrice":8.83,"status":"stock","addedAt":"01/01/2024"},{"id":"1473","buyPrice":1.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1474","buyPrice":14.79,"status":"stock","addedAt":"01/01/2024"},{"id":"1475","buyPrice":14.5,"status":"stock","addedAt":"01/01/2024"},{"id":"1476","buyPrice":24.41,"status":"stock","addedAt":"01/01/2024"},{"id":"1477","buyPrice":9.45,"status":"vendu","addedAt":"01/01/2024"},{"id":"1478","buyPrice":35.18,"status":"stock","addedAt":"01/01/2024"},{"id":"1479","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1480","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1481","buyPrice":17.8,"status":"vendu","addedAt":"01/01/2024"},{"id":"1482","buyPrice":1.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1483","buyPrice":12.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"1484","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1485","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1486","buyPrice":16.17,"status":"vendu","addedAt":"01/01/2024"},{"id":"1487","buyPrice":14.37,"status":"stock","addedAt":"01/01/2024"},{"id":"1488","buyPrice":16.87,"status":"vendu","addedAt":"01/01/2024"},{"id":"1489","buyPrice":9.9,"status":"vendu","addedAt":"01/01/2024"},{"id":"1490","buyPrice":17.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"1491","buyPrice":9.71,"status":"vendu","addedAt":"01/01/2024"},{"id":"1492","buyPrice":18.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"1493","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1494","buyPrice":40.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1495","buyPrice":24.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1496","buyPrice":9.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1497","buyPrice":35.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1498","buyPrice":21.57,"status":"vendu","addedAt":"01/01/2024"},{"id":"1499","buyPrice":14.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"1500","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1501","buyPrice":17.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1502","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1503","buyPrice":5.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1504","buyPrice":13.99,"status":"stock","addedAt":"01/01/2024"},{"id":"1505","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"1506","buyPrice":15.13,"status":"stock","addedAt":"01/01/2024"},{"id":"1507","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1508","buyPrice":5.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1509","buyPrice":5.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1510","buyPrice":17.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1511","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1512","buyPrice":14.08,"status":"vendu","addedAt":"01/01/2024"},{"id":"1513","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1514","buyPrice":45.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1515","buyPrice":19.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1516","buyPrice":25.05,"status":"stock","addedAt":"01/01/2024"},{"id":"1517","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1518","buyPrice":31.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1519","buyPrice":23.72,"status":"vendu","addedAt":"01/01/2024"},{"id":"1520","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1521","buyPrice":26.85,"status":"stock","addedAt":"01/01/2024"},{"id":"1522","buyPrice":19.56,"status":"vendu","addedAt":"01/01/2024"},{"id":"1523","buyPrice":11.39,"status":"vendu","addedAt":"01/01/2024"},{"id":"1524","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1525","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1526","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1527","buyPrice":25.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"1528","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1529","buyPrice":19.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"1530","buyPrice":14.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"1531","buyPrice":14.28,"status":"vendu","addedAt":"01/01/2024"},{"id":"1532","buyPrice":19.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1533","buyPrice":14.29,"status":"stock","addedAt":"01/01/2024"},{"id":"1534","buyPrice":19.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1535","buyPrice":14.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1536","buyPrice":19.5,"status":"stock","addedAt":"01/01/2024"},{"id":"1537","buyPrice":16.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1538","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1539","buyPrice":14.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"1540","buyPrice":9.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"1541","buyPrice":9.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1542","buyPrice":14.28,"status":"stock","addedAt":"01/01/2024"},{"id":"1543","buyPrice":14.29,"status":"vendu","addedAt":"01/01/2024"},{"id":"1544","buyPrice":21.66,"status":"vendu","addedAt":"01/01/2024"},{"id":"1545","buyPrice":8.78,"status":"vendu","addedAt":"01/01/2024"},{"id":"1546","buyPrice":17.99,"status":"stock","addedAt":"01/01/2024"},{"id":"1547","buyPrice":19.5,"status":"vendu","addedAt":"01/01/2024"},{"id":"1548","buyPrice":14.48,"status":"stock","addedAt":"01/01/2024"},{"id":"1549","buyPrice":7.74,"status":"vendu","addedAt":"01/01/2024"},{"id":"1550","buyPrice":14.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1551","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1552","buyPrice":17.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1553","buyPrice":12.01,"status":"vendu","addedAt":"01/01/2024"},{"id":"1554","buyPrice":16.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1555","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1556","buyPrice":14.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1557","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1558","buyPrice":11.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1559","buyPrice":9.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1560","buyPrice":14.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1561","buyPrice":15.59,"status":"stock","addedAt":"01/01/2024"},{"id":"1562","buyPrice":17.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1563","buyPrice":14.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1564","buyPrice":20.86,"status":"vendu","addedAt":"01/01/2024"},{"id":"1565","buyPrice":16.69,"status":"vendu","addedAt":"01/01/2024"},{"id":"1566","buyPrice":29.41,"status":"stock","addedAt":"01/01/2024"},{"id":"1567","buyPrice":18.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"1568","buyPrice":15.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"1569","buyPrice":9.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1570","buyPrice":23.99,"status":"vendu","addedAt":"01/01/2024"},{"id":"1571","buyPrice":16.89,"status":"vendu","addedAt":"01/01/2024"},{"id":"1572","buyPrice":35.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1573","buyPrice":14.54,"status":"vendu","addedAt":"01/01/2024"},{"id":"1574","buyPrice":14.48,"status":"vendu","addedAt":"01/01/2024"},{"id":"1575","buyPrice":18.49,"status":"stock","addedAt":"01/01/2024"},{"id":"1576","buyPrice":25.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1577","buyPrice":23.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1578","buyPrice":16.65,"status":"vendu","addedAt":"01/01/2024"},{"id":"1579","buyPrice":15.96,"status":"stock","addedAt":"01/01/2024"},{"id":"1580","buyPrice":14.99,"status":"stock","addedAt":"01/01/2024"},{"id":"1581","buyPrice":14.49,"status":"vendu","addedAt":"01/01/2024"},{"id":"1582","buyPrice":45.77,"status":"vendu","addedAt":"01/01/2024"},{"id":"1583","buyPrice":14.28,"status":"vendu","addedAt":"01/01/2024"},{"id":"1584","buyPrice":12.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"1585","buyPrice":24.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1586","buyPrice":16.7,"status":"stock","addedAt":"01/01/2024"},{"id":"1587","buyPrice":13.99,"status":"stock","addedAt":"01/01/2024"},{"id":"1588","buyPrice":19.9,"status":"stock","addedAt":"01/01/2024"},{"id":"1589","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1590","buyPrice":14.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1591","buyPrice":14.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1592","buyPrice":14.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1593","buyPrice":9.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1594","buyPrice":10.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1595","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1596","buyPrice":6.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1597","buyPrice":6.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1598","buyPrice":11.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1599","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1600","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1601","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1602","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1603","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1604","buyPrice":19.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1605","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1606","buyPrice":12.2,"status":"vendu","addedAt":"01/01/2024"},{"id":"1607","buyPrice":26.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1608","buyPrice":16.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1609","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1610","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1611","buyPrice":17.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1612","buyPrice":19.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1613","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1614","buyPrice":14.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1615","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1616","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1617","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1618","buyPrice":29.99,"status":"stock","addedAt":"01/01/2024"},{"id":"1619","buyPrice":16.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1620","buyPrice":30.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1621","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1622","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1623","buyPrice":33.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1624","buyPrice":18.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1625","buyPrice":18.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1626","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1627","buyPrice":21.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1628","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1629","buyPrice":18.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1630","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1631","buyPrice":22.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1632","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1633","buyPrice":8.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1634","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1635","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1636","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1637","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1638","buyPrice":24.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1639","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1640","buyPrice":10.61,"status":"stock","addedAt":"01/01/2024"},{"id":"1641","buyPrice":16.69,"status":"stock","addedAt":"01/01/2024"},{"id":"1642","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1643","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1644","buyPrice":10.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1645","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1646","buyPrice":12.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1647","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1648","buyPrice":9.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1649","buyPrice":16.59,"status":"vendu","addedAt":"01/01/2024"},{"id":"1650","buyPrice":14.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1651","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1652","buyPrice":13.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1653","buyPrice":12.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1654","buyPrice":12.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1655","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1656","buyPrice":17.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1657","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1658","buyPrice":14.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1659","buyPrice":24.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1660","buyPrice":14.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1661","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1662","buyPrice":13.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1663","buyPrice":26.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1664","buyPrice":11.38,"status":"stock","addedAt":"01/01/2024"},{"id":"1665","buyPrice":25.81,"status":"vendu","addedAt":"01/01/2024"},{"id":"1666","buyPrice":20.76,"status":"vendu","addedAt":"01/01/2024"},{"id":"1667","buyPrice":19.3,"status":"vendu","addedAt":"01/01/2024"},{"id":"1668","buyPrice":11.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1669","buyPrice":16.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1670","buyPrice":15.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1671","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1672","buyPrice":27.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1673","buyPrice":17.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1674","buyPrice":12.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1675","buyPrice":11.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1676","buyPrice":9.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1677","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1678","buyPrice":20.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1679","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1680","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1681","buyPrice":16.87,"status":"stock","addedAt":"01/01/2024"},{"id":"1682","buyPrice":21.0,"status":"vendu","addedAt":"01/01/2024"},{"id":"1683","buyPrice":14.09,"status":"vendu","addedAt":"01/01/2024"},{"id":"1684","buyPrice":14.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1685","buyPrice":11.67,"status":"stock","addedAt":"01/01/2024"},{"id":"1686","buyPrice":16.5,"status":"stock","addedAt":"01/01/2024"},{"id":"1687","buyPrice":16.87,"status":"vendu","addedAt":"01/01/2024"},{"id":"1688","buyPrice":16.59,"status":"stock","addedAt":"01/01/2024"},{"id":"1689","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1690","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1691","buyPrice":17.63,"status":"stock","addedAt":"01/01/2024"},{"id":"1692","buyPrice":17.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1693","buyPrice":11.8,"status":"stock","addedAt":"01/01/2024"},{"id":"1694","buyPrice":12.71,"status":"stock","addedAt":"01/01/2024"},{"id":"1695","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1696","buyPrice":15.96,"status":"stock","addedAt":"01/01/2024"},{"id":"1697","buyPrice":29.9,"status":"stock","addedAt":"01/01/2024"},{"id":"1698","buyPrice":19.3,"status":"stock","addedAt":"01/01/2024"},{"id":"1699","buyPrice":16.36,"status":"stock","addedAt":"01/01/2024"},{"id":"1700","buyPrice":22.61,"status":"stock","addedAt":"01/01/2024"},{"id":"1701","buyPrice":17.63,"status":"stock","addedAt":"01/01/2024"},{"id":"1702","buyPrice":19.49,"status":"stock","addedAt":"01/01/2024"},{"id":"1703","buyPrice":11.49,"status":"stock","addedAt":"01/01/2024"},{"id":"1704","buyPrice":18.77,"status":"stock","addedAt":"01/01/2024"},{"id":"1705","buyPrice":14.65,"status":"stock","addedAt":"01/01/2024"},{"id":"1706","buyPrice":18.57,"status":"stock","addedAt":"01/01/2024"},{"id":"1707","buyPrice":16.36,"status":"stock","addedAt":"01/01/2024"},{"id":"1708","buyPrice":46.64,"status":"stock","addedAt":"01/01/2024"},{"id":"1709","buyPrice":22.21,"status":"stock","addedAt":"01/01/2024"},{"id":"1710","buyPrice":12.25,"status":"stock","addedAt":"01/01/2024"},{"id":"1711","buyPrice":13.89,"status":"stock","addedAt":"01/01/2024"},{"id":"1712","buyPrice":17.49,"status":"stock","addedAt":"01/01/2024"},{"id":"1713","buyPrice":19.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1714","buyPrice":19.82,"status":"stock","addedAt":"01/01/2024"},{"id":"1715","buyPrice":16.45,"status":"stock","addedAt":"01/01/2024"},{"id":"1716","buyPrice":19.09,"status":"stock","addedAt":"01/01/2024"},{"id":"1717","buyPrice":19.49,"status":"stock","addedAt":"01/01/2024"},{"id":"1718","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1719","buyPrice":18.77,"status":"stock","addedAt":"01/01/2024"},{"id":"1720","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1721","buyPrice":18.13,"status":"stock","addedAt":"01/01/2024"},{"id":"1722","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1723","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1724","buyPrice":21.57,"status":"stock","addedAt":"01/01/2024"},{"id":"1725","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1726","buyPrice":10.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1727","buyPrice":13.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1728","buyPrice":16.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1729","buyPrice":12.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1730","buyPrice":12.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1731","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1732","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1733","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1734","buyPrice":13.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1735","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1736","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1737","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1738","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1739","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1740","buyPrice":12.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1741","buyPrice":18.36,"status":"stock","addedAt":"01/01/2024"},{"id":"1742","buyPrice":19.81,"status":"stock","addedAt":"01/01/2024"},{"id":"1743","buyPrice":12.2,"status":"stock","addedAt":"01/01/2024"},{"id":"1744","buyPrice":14.28,"status":"stock","addedAt":"01/01/2024"},{"id":"1745","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1746","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1747","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1748","buyPrice":45.53,"status":"stock","addedAt":"01/01/2024"},{"id":"1749","buyPrice":35.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1750","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1751","buyPrice":17.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1752","buyPrice":16.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1753","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1754","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1755","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1756","buyPrice":30.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1757","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1758","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1759","buyPrice":12.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1760","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1761","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1762","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1763","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1764","buyPrice":10.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1765","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1766","buyPrice":19.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1767","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1768","buyPrice":29.9,"status":"stock","addedAt":"01/01/2024"},{"id":"1769","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1770","buyPrice":12.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1771","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1772","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1773","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1774","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1775","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1776","buyPrice":19.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1777","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1778","buyPrice":17.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1779","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1780","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1781","buyPrice":17.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1782","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1783","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1784","buyPrice":15.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1785","buyPrice":12.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1786","buyPrice":22.61,"status":"stock","addedAt":"01/01/2024"},{"id":"1787","buyPrice":16.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1788","buyPrice":18.77,"status":"stock","addedAt":"01/01/2024"},{"id":"1789","buyPrice":18.45,"status":"stock","addedAt":"01/01/2024"},{"id":"1790","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1791","buyPrice":20.7,"status":"stock","addedAt":"01/01/2024"},{"id":"1792","buyPrice":46.5,"status":"stock","addedAt":"01/01/2024"},{"id":"1793","buyPrice":45.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1794","buyPrice":13.3,"status":"stock","addedAt":"01/01/2024"},{"id":"1795","buyPrice":19.33,"status":"stock","addedAt":"01/01/2024"},{"id":"1796","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1797","buyPrice":26.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1798","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1799","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1800","buyPrice":16.36,"status":"stock","addedAt":"01/01/2024"},{"id":"1801","buyPrice":10.5,"status":"stock","addedAt":"01/01/2024"},{"id":"1802","buyPrice":11.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1803","buyPrice":16.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1804","buyPrice":42.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1805","buyPrice":20.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1806","buyPrice":14.5,"status":"stock","addedAt":"01/01/2024"},{"id":"1807","buyPrice":13.88,"status":"stock","addedAt":"01/01/2024"},{"id":"1808","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1809","buyPrice":15.65,"status":"stock","addedAt":"01/01/2024"},{"id":"1810","buyPrice":17.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1811","buyPrice":18.0,"status":"stock","addedAt":"01/01/2024"},{"id":"1812","buyPrice":27.71,"status":"stock","addedAt":"01/01/2024"},{"id":"1813","buyPrice":16.58,"status":"stock","addedAt":"01/01/2024"},{"id":"1814","buyPrice":17.5,"status":"stock","addedAt":"01/01/2024"},{"id":"1815","buyPrice":25.0,"status":"stock","addedAt":"01/01/2024"}];
const INIT_SAL = [{"id":"s0001","productId":"Casquette roger","buyPrice":14.5,"sellPrice":14.68,"profit":0.18,"multi":1.01,"saleDate":"05/03/2025","receiveDate":"26/03/2025","createdAt":"2025-03-05T00:00:00.000Z"},{"id":"s0002","productId":"New balance 2002 r beige","buyPrice":25.14,"sellPrice":60.5,"profit":35.36,"multi":2.41,"saleDate":"05/03/2025","receiveDate":"24/03/2025","createdAt":"2025-03-05T00:00:00.000Z"},{"id":"s0003","productId":"Nike zoom vaporpro hc noir","buyPrice":21.83,"sellPrice":65.68,"profit":43.85,"multi":3.01,"saleDate":"06/03/2025","receiveDate":"26/03/2025","createdAt":"2025-03-06T00:00:00.000Z"},{"id":"s0004","productId":"Air max 95 essential","buyPrice":24.98,"sellPrice":75.25,"profit":50.27,"multi":3.01,"saleDate":"06/03/2025","receiveDate":"26/03/2025","createdAt":"2025-03-06T00:00:00.000Z"},{"id":"s0005","productId":"Nike zoom vapor 11","buyPrice":20.32,"sellPrice":36.0,"profit":15.68,"multi":1.77,"saleDate":"09/03/2025","receiveDate":"31/03/2025","createdAt":"2025-03-09T00:00:00.000Z"},{"id":"s0006","productId":"Asics gel résolution 9","buyPrice":31.54,"sellPrice":65.48,"profit":33.94,"multi":2.08,"saleDate":"10/03/2025","receiveDate":"02/04/2025","createdAt":"2025-03-10T00:00:00.000Z"},{"id":"s0007","productId":"Asics djoko court ff 3","buyPrice":15.59,"sellPrice":45.63,"profit":30.04,"multi":2.93,"saleDate":"11/03/2025","receiveDate":"01/04/2024","createdAt":"2025-03-11T00:00:00.000Z"},{"id":"s0008","productId":"new balance 2002","buyPrice":26.05,"sellPrice":40.5,"profit":14.45,"multi":1.55,"saleDate":"12/03/2025","receiveDate":"31/03/2025","createdAt":"2025-03-12T00:00:00.000Z"},{"id":"s0009","productId":"Air max 95 icons","buyPrice":22.9,"sellPrice":53.5,"profit":30.6,"multi":2.34,"saleDate":"12/03/2025","receiveDate":"01/04/2025","createdAt":"2025-03-12T00:00:00.000Z"},{"id":"s0010","productId":"Veste djokovic","buyPrice":10.28,"sellPrice":37.15,"profit":26.87,"multi":3.61,"saleDate":"12/03/2025","receiveDate":"02/04/2025","createdAt":"2025-03-12T00:00:00.000Z"},{"id":"s0011","productId":"Air max 95 full black","buyPrice":30.13,"sellPrice":40.98,"profit":10.85,"multi":1.36,"saleDate":"13/03/2025","receiveDate":"02/04/2025","createdAt":"2025-03-13T00:00:00.000Z"},{"id":"s0012","productId":"Nike zoom vapor pro hc bleu","buyPrice":36.22,"sellPrice":90.48,"profit":54.26,"multi":2.5,"saleDate":"14/03/2025","receiveDate":"01/04/2025","createdAt":"2025-03-14T00:00:00.000Z"},{"id":"s0013","productId":"Nike zoom vapor pro hc verte noir","buyPrice":38.19,"sellPrice":75.5,"profit":37.31,"multi":1.98,"saleDate":"14/03/2025","receiveDate":"09/04/2025","createdAt":"2025-03-14T00:00:00.000Z"},{"id":"s0014","productId":"Asics gel résolution 9","buyPrice":62.99,"sellPrice":76.68,"profit":13.69,"multi":1.22,"saleDate":"19/03/2025","receiveDate":"07/04/2025","createdAt":"2025-03-19T00:00:00.000Z"},{"id":"s0015","productId":"Adidas samba","buyPrice":21.42,"sellPrice":74.5,"profit":53.08,"multi":3.48,"saleDate":"19/03/2025","receiveDate":"10/04/2025","createdAt":"2025-03-19T00:00:00.000Z"},{"id":"s0016","productId":"Asics gel resolution 9","buyPrice":25.59,"sellPrice":30.5,"profit":4.91,"multi":1.19,"saleDate":"23/03/2025","receiveDate":"11/04/2025","createdAt":"2025-03-23T00:00:00.000Z"},{"id":"s0017","productId":"Nike zoom vapor pro 2 verte et blanche","buyPrice":14.09,"sellPrice":45.5,"profit":31.41,"multi":3.23,"saleDate":"23/03/2025","receiveDate":"09/04/2025","createdAt":"2025-03-23T00:00:00.000Z"},{"id":"s0018","productId":"Nike air max 95 essential","buyPrice":19.64,"sellPrice":40.0,"profit":20.36,"multi":2.04,"saleDate":"23/03/2025","receiveDate":"14/04/2025","createdAt":"2025-03-23T00:00:00.000Z"},{"id":"s0019","productId":"Lot 2 articles nike zoom vapor 11 et 2 Wimbledon","buyPrice":15.39,"sellPrice":60.63,"profit":45.24,"multi":3.94,"saleDate":"25/03/2025","receiveDate":"14/04/2025","createdAt":"2025-03-25T00:00:00.000Z"},{"id":"s0020","productId":"Nike vapor pro hc grises","buyPrice":66.5,"sellPrice":150.63,"profit":84.13,"multi":2.27,"saleDate":"27/03/2025","receiveDate":"25/04/2025","createdAt":"2025-03-27T00:00:00.000Z"},{"id":"s0021","productId":"Nike zoom vapor 11","buyPrice":31.01,"sellPrice":60.06,"profit":29.05,"multi":1.94,"saleDate":"02/03/2025","receiveDate":"22/04/2025","createdAt":"2025-03-02T00:00:00.000Z"},{"id":"s0022","productId":"Pantalon rafa Wim","buyPrice":34.68,"sellPrice":80.55,"profit":45.87,"multi":2.32,"saleDate":"28/03/2025","receiveDate":"22/04/2025","createdAt":"2025-03-28T00:00:00.000Z"},{"id":"s0023","productId":"Nike zoom vapor pro 2 wmb","buyPrice":26.09,"sellPrice":45.68,"profit":19.59,"multi":1.75,"saleDate":"29/03/2025","receiveDate":"18/04/2025","createdAt":"2025-03-29T00:00:00.000Z"},{"id":"s0024","productId":"Nike zoom vapor pro 2 beige","buyPrice":26.88,"sellPrice":55.53,"profit":28.65,"multi":2.07,"saleDate":"01/04/2025","receiveDate":"18/04/2025","createdAt":"2025-04-01T00:00:00.000Z"},{"id":"s0025","productId":"Nike P-6000","buyPrice":36.59,"sellPrice":69.73,"profit":33.14,"multi":1.91,"saleDate":"01/04/2025","receiveDate":"15/04/2025","createdAt":"2025-04-01T00:00:00.000Z"},{"id":"s0026","productId":"Nike zoom vapor pro 2 parís","buyPrice":25.31,"sellPrice":49.71,"profit":24.4,"multi":1.96,"saleDate":"02/04/2025","receiveDate":"15/04/2025","createdAt":"2025-04-02T00:00:00.000Z"},{"id":"s0027","productId":"adidas campus noires","buyPrice":63.0,"sellPrice":70.55,"profit":7.55,"multi":1.12,"saleDate":"02/04/2025","receiveDate":"14/04/2025","createdAt":"2025-04-02T00:00:00.000Z"},{"id":"s0028","productId":"New balance 327","buyPrice":11.0,"sellPrice":35.63,"profit":24.63,"multi":3.24,"saleDate":"03/04/2025","receiveDate":"23/04/2025","createdAt":"2025-04-03T00:00:00.000Z"},{"id":"s0029","productId":"Nike air max 95 essential","buyPrice":12.75,"sellPrice":30.53,"profit":17.78,"multi":2.39,"saleDate":"05/04/2025","receiveDate":"24/04/2025","createdAt":"2025-04-05T00:00:00.000Z"},{"id":"s0030","productId":"Nike zoom vapor pro hc blanches","buyPrice":59.44,"sellPrice":125.0,"profit":65.56,"multi":2.1,"saleDate":"06/04/2025","receiveDate":"24/04/2025","createdAt":"2025-04-06T00:00:00.000Z"},{"id":"s0031","productId":"Lot 2 articles nike zoom vapour pro hc","buyPrice":21.04,"sellPrice":50.5,"profit":29.46,"multi":2.4,"saleDate":"06/04/2025","receiveDate":"29/04/2025","createdAt":"2025-04-06T00:00:00.000Z"},{"id":"s0032","productId":"Nike air max 95 femme violette","buyPrice":20.0,"sellPrice":35.63,"profit":15.63,"multi":1.78,"saleDate":"08/04/2025","receiveDate":"28/04/2025","createdAt":"2025-04-08T00:00:00.000Z"},{"id":"s0033","productId":"Nike air force 1 blanche","buyPrice":17.4,"sellPrice":53.63,"profit":36.23,"multi":3.08,"saleDate":"09/04/2025","receiveDate":"28/04/2025","createdAt":"2025-04-09T00:00:00.000Z"},{"id":"s0034","productId":"Nike zoom vapor pro bleu et blanche","buyPrice":30.0,"sellPrice":75.48,"profit":45.48,"multi":2.52,"saleDate":"09/04/2025","receiveDate":"02/05/2025","createdAt":"2025-04-09T00:00:00.000Z"},{"id":"s0035","productId":"Nike zoom vapor pro hc","buyPrice":23.72,"sellPrice":49.55,"profit":25.83,"multi":2.09,"saleDate":"10/04/2025","receiveDate":"02/05/2025","createdAt":"2025-04-10T00:00:00.000Z"},{"id":"s0036","productId":"Adidas gazelle ancien modele bleu","buyPrice":12.71,"sellPrice":24.63,"profit":11.92,"multi":1.94,"saleDate":"11/04/2025","receiveDate":"20/04/2025","createdAt":"2025-04-11T00:00:00.000Z"},{"id":"s0037","productId":"Asics court ff 2 rose","buyPrice":10.98,"sellPrice":28.63,"profit":17.65,"multi":2.61,"saleDate":"13/04/2025","receiveDate":"02/05/2025","createdAt":"2025-04-13T00:00:00.000Z"},{"id":"s0038","productId":"New balance protection pack beige","buyPrice":36.22,"sellPrice":68.5,"profit":32.28,"multi":1.89,"saleDate":"14/03/2025","receiveDate":"02/05/2025","createdAt":"2025-03-14T00:00:00.000Z"},{"id":"s0039","productId":"Asics gel résolution 9 blanche","buyPrice":8.67,"sellPrice":40.63,"profit":31.96,"multi":4.69,"saleDate":"14/04/2025","receiveDate":"02/05/2025","createdAt":"2025-04-14T00:00:00.000Z"},{"id":"s0040","productId":"Chaussures de running rival fly nike","buyPrice":12.71,"sellPrice":22.55,"profit":9.84,"multi":1.77,"saleDate":"14/04/2025","receiveDate":"02/05/2025","createdAt":"2025-04-14T00:00:00.000Z"},{"id":"s0041","productId":"Hoka bondi","buyPrice":17.9,"sellPrice":45.63,"profit":27.73,"multi":2.55,"saleDate":"15/04/2025","receiveDate":"02/05/2025","createdAt":"2025-04-15T00:00:00.000Z"},{"id":"s0042","productId":"Nike zoom vapor pro hc logo multi color","buyPrice":27.39,"sellPrice":70.74,"profit":43.35,"multi":2.58,"saleDate":"15/04/2025","receiveDate":"07/05/2025","createdAt":"2025-04-15T00:00:00.000Z"},{"id":"s0043","productId":"New balance 530","buyPrice":8.87,"sellPrice":40.25,"profit":31.38,"multi":4.54,"saleDate":"16/04/2025","receiveDate":"07/05/2025","createdAt":"2025-04-16T00:00:00.000Z"},{"id":"s0044","productId":"New balance 2002 r bleu","buyPrice":30.0,"sellPrice":40.71,"profit":10.71,"multi":1.36,"saleDate":"16/04/2025","receiveDate":"19/05/2025","createdAt":"2025-04-16T00:00:00.000Z"},{"id":"s0045","productId":"Asics gel résolution 9","buyPrice":15.59,"sellPrice":33.54,"profit":17.95,"multi":2.15,"saleDate":"17/04/2025","receiveDate":"08/05/2025","createdAt":"2025-04-17T00:00:00.000Z"},{"id":"s0046","productId":"Asics gel challenger panel","buyPrice":8.1,"sellPrice":25.54,"profit":17.44,"multi":3.15,"saleDate":"17/04/2025","receiveDate":"12/05/2025","createdAt":"2025-04-17T00:00:00.000Z"},{"id":"s0047","productId":"Nike air max 95 neon","buyPrice":27.28,"sellPrice":80.55,"profit":53.27,"multi":2.95,"saleDate":"18/04/2025","receiveDate":"09/05/2025","createdAt":"2025-04-18T00:00:00.000Z"},{"id":"s0048","productId":"asics court ff 2djoko","buyPrice":17.08,"sellPrice":45.5,"profit":28.42,"multi":2.66,"saleDate":"18/04/2025","receiveDate":"09/05/2025","createdAt":"2025-04-18T00:00:00.000Z"},{"id":"s0049","productId":"Nike air max 95 essential blanche et jaune","buyPrice":25.2,"sellPrice":45.63,"profit":20.43,"multi":1.81,"saleDate":"19/04/2025","receiveDate":"09/05/2025","createdAt":"2025-04-19T00:00:00.000Z"},{"id":"s0050","productId":"nike vapor pro pour jemma","buyPrice":38.73,"sellPrice":75.55,"profit":36.82,"multi":1.95,"saleDate":"19/04/2025","receiveDate":"09/05/2025","createdAt":"2025-04-19T00:00:00.000Z"},{"id":"s0051","productId":"Chaussures athletisme","buyPrice":1.0,"sellPrice":5.0,"profit":4.0,"multi":5.0,"saleDate":"20/04/2025","receiveDate":"09/05/2025","createdAt":"2025-04-20T00:00:00.000Z"},{"id":"s0052","productId":"Adidas spezial bleu","buyPrice":22.91,"sellPrice":66.45,"profit":43.54,"multi":2.9,"saleDate":"21/04/2025","receiveDate":"08/05/2025","createdAt":"2025-04-21T00:00:00.000Z"},{"id":"s0053","productId":"Asics gel résolution 9","buyPrice":12.2,"sellPrice":36.63,"profit":24.43,"multi":3.0,"saleDate":"21/04/2025","receiveDate":"09/05/2025","createdAt":"2025-04-21T00:00:00.000Z"},{"id":"s0054","productId":"Nike p6000","buyPrice":19.3,"sellPrice":48.0,"profit":28.7,"multi":2.49,"saleDate":"19/04/2025","receiveDate":"09/05/2025","createdAt":"2025-04-19T00:00:00.000Z"},{"id":"s0055","productId":"Adidas samba noires","buyPrice":19.49,"sellPrice":62.43,"profit":42.94,"multi":3.2,"saleDate":"21/04/2025","receiveDate":"09/05/2025","createdAt":"2025-04-21T00:00:00.000Z"},{"id":"s0056","productId":"Adidas gazelles blanche vertes","buyPrice":17.7,"sellPrice":48.55,"profit":30.85,"multi":2.74,"saleDate":"21/04/2025","receiveDate":"09/05/2025","createdAt":"2025-04-21T00:00:00.000Z"},{"id":"s0057","productId":"Nike vapor pro roses","buyPrice":15.0,"sellPrice":30.25,"profit":15.25,"multi":2.02,"saleDate":"21/04/2025","receiveDate":"16/05/2025","createdAt":"2025-04-21T00:00:00.000Z"},{"id":"s0058","productId":"Tee shirt rafa bleu","buyPrice":32.0,"sellPrice":55.54,"profit":23.54,"multi":1.74,"saleDate":"20/04/2025","receiveDate":"13/05/2025","createdAt":"2025-04-20T00:00:00.000Z"},{"id":"s0059","productId":"New balance 327","buyPrice":8.67,"sellPrice":30.55,"profit":21.88,"multi":3.52,"saleDate":"22/04/2025","receiveDate":"14/05/2025","createdAt":"2025-04-22T00:00:00.000Z"},{"id":"s0060","productId":"Nike zoom vapor pro hc rose","buyPrice":25.21,"sellPrice":65.73,"profit":40.52,"multi":2.61,"saleDate":"22/04/2025","receiveDate":"12/05/2025","createdAt":"2025-04-22T00:00:00.000Z"},{"id":"s0061","productId":"nike zoom vapor pro hc","buyPrice":25.21,"sellPrice":60.63,"profit":35.42,"multi":2.4,"saleDate":"24/04/2025","receiveDate":"14/05/2025","createdAt":"2025-04-24T00:00:00.000Z"},{"id":"s0062","productId":"nike zoom vapor pro hc 2","buyPrice":22.0,"sellPrice":40.5,"profit":18.5,"multi":1.84,"saleDate":"24/04/2025","receiveDate":"12/05/2025","createdAt":"2025-04-24T00:00:00.000Z"},{"id":"s0063","productId":"nike cage 4t","buyPrice":1.0,"sellPrice":20.73,"profit":19.73,"multi":20.73,"saleDate":"29/04/2025","receiveDate":"13/05/20225","createdAt":"2025-04-29T00:00:00.000Z"},{"id":"s0064","productId":"adidas campus grises","buyPrice":14.89,"sellPrice":40.63,"profit":25.74,"multi":2.73,"saleDate":"25/04/2025","receiveDate":"16/05/2025","createdAt":"2025-04-25T00:00:00.000Z"},{"id":"s0065","productId":"nike zoom vapor pro hc 2","buyPrice":62.99,"sellPrice":65.5,"profit":2.51,"multi":1.04,"saleDate":"26/04/2025","receiveDate":"20/05/2025","createdAt":"2025-04-26T00:00:00.000Z"},{"id":"s0066","productId":"asics metaspeed sky","buyPrice":16.36,"sellPrice":75.55,"profit":59.19,"multi":4.62,"saleDate":"27/04/2025","receiveDate":"19/05/2025","createdAt":"2025-04-27T00:00:00.000Z"},{"id":"s0067","productId":"casque razer blackshark","buyPrice":16.36,"sellPrice":30.55,"profit":14.19,"multi":1.87,"saleDate":"27/04/2025","receiveDate":"23/05/2025","createdAt":"2025-04-27T00:00:00.000Z"},{"id":"s0068","productId":"adidas spezial bleu","buyPrice":4.0,"sellPrice":45.71,"profit":41.71,"multi":11.43,"saleDate":"20/04/2025","receiveDate":"23/05/2025","createdAt":"2025-04-20T00:00:00.000Z"},{"id":"s0069","productId":"nike tn pal gree,","buyPrice":24.7,"sellPrice":70.73,"profit":46.03,"multi":2.86,"saleDate":"02/05/2025","receiveDate":"26/05/2025","createdAt":"2025-05-02T00:00:00.000Z"},{"id":"s0070","productId":"nike zoom vapor pro hc blanche logo bleu","buyPrice":46.64,"sellPrice":110.63,"profit":63.99,"multi":2.37,"saleDate":"02/05/2025","receiveDate":"23/05/2025","createdAt":"2025-05-02T00:00:00.000Z"},{"id":"s0071","productId":"nike zoom vapor hc 2","buyPrice":25.55,"sellPrice":57.5,"profit":31.95,"multi":2.25,"saleDate":"02/05/2025","receiveDate":"23/05/2025","createdAt":"2025-05-02T00:00:00.000Z"},{"id":"s0072","productId":"nike zoom vapor pro hc 2","buyPrice":26.88,"sellPrice":62.53,"profit":35.65,"multi":2.33,"saleDate":"02/05/2025","receiveDate":"27/05/2025","createdAt":"2025-05-02T00:00:00.000Z"},{"id":"s0073","productId":"asics gel résolution 9","buyPrice":22.0,"sellPrice":56.43,"profit":34.43,"multi":2.56,"saleDate":"03/05/2025","receiveDate":"02/06/2025","createdAt":"2025-05-03T00:00:00.000Z"},{"id":"s0074","productId":"air max 90","buyPrice":11.15,"sellPrice":40.9,"profit":29.75,"multi":3.67,"saleDate":"03/05/2025","receiveDate":"26/05/2025","createdAt":"2025-05-03T00:00:00.000Z"},{"id":"s0075","productId":"gazelle adidas jaune","buyPrice":8.64,"sellPrice":25.71,"profit":17.07,"multi":2.98,"saleDate":"03/05/2025","receiveDate":"23/05/2025","createdAt":"2025-05-03T00:00:00.000Z"},{"id":"s0076","productId":"asics novablast","buyPrice":20.1,"sellPrice":55.55,"profit":35.45,"multi":2.76,"saleDate":"04/05/2025","receiveDate":"20/05/2025","createdAt":"2025-05-04T00:00:00.000Z"},{"id":"s0077","productId":"nike air max 95 full black","buyPrice":20.6,"sellPrice":110.0,"profit":89.4,"multi":5.34,"saleDate":"04/05/2025","receiveDate":"21/05/2025","createdAt":"2025-05-04T00:00:00.000Z"},{"id":"s0078","productId":"adidas samba femme rose","buyPrice":19.49,"sellPrice":40.55,"profit":21.06,"multi":2.08,"saleDate":"04/05/2025","receiveDate":"26/05/2025","createdAt":"2025-05-04T00:00:00.000Z"},{"id":"s0079","productId":"adidas solution speed ff","buyPrice":7.55,"sellPrice":30.38,"profit":22.83,"multi":4.02,"saleDate":"05/05/2025","receiveDate":"29/05/2025","createdAt":"2025-05-05T00:00:00.000Z"},{"id":"s0080","productId":"adidas samba","buyPrice":10.0,"sellPrice":29.54,"profit":19.54,"multi":2.95,"saleDate":"06/05/2025","receiveDate":"28/05/2025","createdAt":"2025-05-06T00:00:00.000Z"},{"id":"s0081","productId":"adidas spezial verte","buyPrice":16.39,"sellPrice":47.63,"profit":31.24,"multi":2.91,"saleDate":"07/05/2025","receiveDate":"02/06/2025","createdAt":"2025-05-07T00:00:00.000Z"},{"id":"s0082","productId":"lot 3 article 2 gazelle 550","buyPrice":24.03,"sellPrice":60.97,"profit":36.94,"multi":2.54,"saleDate":"08/05/2025","receiveDate":"30/05/2025","createdAt":"2025-05-08T00:00:00.000Z"},{"id":"s0083","productId":"hoka bondi 8","buyPrice":19.49,"sellPrice":75.63,"profit":56.14,"multi":3.88,"saleDate":"10/05/2025","receiveDate":"30/05/2025","createdAt":"2025-05-10T00:00:00.000Z"},{"id":"s0084","productId":"air force 1 blanche","buyPrice":8.28,"sellPrice":25.71,"profit":17.43,"multi":3.11,"saleDate":"10/05/2025","receiveDate":"03/06/2025","createdAt":"2025-05-10T00:00:00.000Z"},{"id":"s0085","productId":"nike zoom vapor wblm","buyPrice":26.88,"sellPrice":50.74,"profit":23.86,"multi":1.89,"saleDate":"11/05/2025","receiveDate":"03/06/2025","createdAt":"2025-05-11T00:00:00.000Z"},{"id":"s0086","productId":"new balance 2002r","buyPrice":23.46,"sellPrice":53.65,"profit":30.19,"multi":2.29,"saleDate":"11/05/2025","receiveDate":"28/05/2025","createdAt":"2025-05-11T00:00:00.000Z"},{"id":"s0087","productId":"adidas samba og","buyPrice":17.27,"sellPrice":47.92,"profit":30.65,"multi":2.77,"saleDate":"11/05/2025","receiveDate":"03/06/2025","createdAt":"2025-05-11T00:00:00.000Z"},{"id":"s0088","productId":"nike zoom vapor pr o","buyPrice":19.3,"sellPrice":55.0,"profit":35.7,"multi":2.85,"saleDate":"11/05/2025","receiveDate":"03/06/2025","createdAt":"2025-05-11T00:00:00.000Z"},{"id":"s0089","productId":"adidas spezial rouge","buyPrice":14.89,"sellPrice":55.63,"profit":40.74,"multi":3.74,"saleDate":"12/05/2025","receiveDate":"02/06/2025","createdAt":"2025-05-12T00:00:00.000Z"},{"id":"s0090","productId":"nike air max 90 futura","buyPrice":13.88,"sellPrice":22.53,"profit":8.65,"multi":1.62,"saleDate":"12/05/2025","receiveDate":"02/06/2025","createdAt":"2025-05-12T00:00:00.000Z"},{"id":"s0091","productId":"nike air max 95 full white","buyPrice":34.92,"sellPrice":70.25,"profit":35.33,"multi":2.01,"saleDate":"12/05/2025","receiveDate":"30/05/2025","createdAt":"2025-05-12T00:00:00.000Z"},{"id":"s0092","productId":"asics gel resolution 9 clay","buyPrice":38.68,"sellPrice":24.4,"profit":-14.28,"multi":0.63,"saleDate":"12/05/2025","receiveDate":"14,28 €","createdAt":"2025-05-12T00:00:00.000Z"},{"id":"s0093","productId":"new balance running fuelcell summit","buyPrice":19.09,"sellPrice":73.8,"profit":54.71,"multi":3.87,"saleDate":"12/05/2025","receiveDate":"03/06/2025","createdAt":"2025-05-12T00:00:00.000Z"},{"id":"s0094","productId":"nike air max 95 essential","buyPrice":47.95,"sellPrice":90.63,"profit":42.68,"multi":1.89,"saleDate":"13/05/2025","receiveDate":"02/06/2025","createdAt":"2025-05-13T00:00:00.000Z"},{"id":"s0095","productId":"adidas samba","buyPrice":20.1,"sellPrice":50.0,"profit":29.9,"multi":2.49,"saleDate":"13/05/2025","receiveDate":"03/06/2025","createdAt":"2025-05-13T00:00:00.000Z"},{"id":"s0096","productId":"adidas spezial bleu","buyPrice":20.1,"sellPrice":32.55,"profit":12.45,"multi":1.62,"saleDate":"14/05/2025","receiveDate":"04/06/2025","createdAt":"2025-05-14T00:00:00.000Z"},{"id":"s0097","productId":"autry","buyPrice":14.09,"sellPrice":45.71,"profit":31.62,"multi":3.24,"saleDate":"14/05/2025","receiveDate":"04/06/2025","createdAt":"2025-05-14T00:00:00.000Z"},{"id":"s0098","productId":"nike air force black","buyPrice":17.8,"sellPrice":35.8,"profit":18.0,"multi":2.01,"saleDate":"14/05/2025","receiveDate":"05/06/2025","createdAt":"2025-05-14T00:00:00.000Z"},{"id":"s0099","productId":"asics gel resolution 9","buyPrice":27.89,"sellPrice":40.63,"profit":12.74,"multi":1.46,"saleDate":"14/05/2025","receiveDate":"03/06/2025","createdAt":"2025-05-14T00:00:00.000Z"},{"id":"s0100","productId":"adidas samba","buyPrice":3.0,"sellPrice":50.63,"profit":47.63,"multi":16.88,"saleDate":"14/05/2025","receiveDate":"02/06/2025","createdAt":"2025-05-14T00:00:00.000Z"},{"id":"s0101","productId":"adidas samba","buyPrice":3.0,"sellPrice":45.55,"profit":42.55,"multi":15.18,"saleDate":"14/05/2025","receiveDate":"02/06/2025","createdAt":"2025-05-14T00:00:00.000Z"},{"id":"s0102","productId":"new balance 2002r","buyPrice":24.51,"sellPrice":53.63,"profit":29.12,"multi":2.19,"saleDate":"14/05/2025","receiveDate":"02/06/2025","createdAt":"2025-05-14T00:00:00.000Z"},{"id":"s0103","productId":"adidas samba","buyPrice":23.52,"sellPrice":50.63,"profit":27.11,"multi":2.15,"saleDate":"15/05/2025","receiveDate":"03/06/2025","createdAt":"2025-05-15T00:00:00.000Z"},{"id":"s0104","productId":"asics court ff clay","buyPrice":17.4,"sellPrice":30.71,"profit":13.31,"multi":1.76,"saleDate":"15/05/2025","receiveDate":"05/06/2025","createdAt":"2025-05-15T00:00:00.000Z"},{"id":"s0105","productId":"asics gel resoltion 9 blue","buyPrice":24.7,"sellPrice":50.63,"profit":25.93,"multi":2.05,"saleDate":"15/05/2025","receiveDate":"03/06/2025","createdAt":"2025-05-15T00:00:00.000Z"},{"id":"s0106","productId":"asics gel resolution 13","buyPrice":5.5,"sellPrice":20.92,"profit":15.42,"multi":3.8,"saleDate":"15/05/2025","receiveDate":"09/06/2025","createdAt":"2025-05-15T00:00:00.000Z"},{"id":"s0107","productId":"nike air max 95 full black","buyPrice":14.89,"sellPrice":45.7,"profit":30.81,"multi":3.07,"saleDate":"16/05/2025","receiveDate":"06/06/2025","createdAt":"2025-05-16T00:00:00.000Z"},{"id":"s0108","productId":"sac wilson","buyPrice":1.0,"sellPrice":3.54,"profit":2.54,"multi":3.54,"saleDate":"18/05/2025","receiveDate":"16/06/2025","createdAt":"2025-05-18T00:00:00.000Z"},{"id":"s0109","productId":"asics gel resoltion 9","buyPrice":21.64,"sellPrice":47.0,"profit":25.36,"multi":2.17,"saleDate":"18/05/2025","receiveDate":"04/06/2025","createdAt":"2025-05-18T00:00:00.000Z"},{"id":"s0110","productId":"asics court ff clay","buyPrice":20.78,"sellPrice":60.63,"profit":39.85,"multi":2.92,"saleDate":"19/05/2025","receiveDate":"10/06/2025","createdAt":"2025-05-19T00:00:00.000Z"},{"id":"s0111","productId":"lot 3 article new balnce air max 95...","buyPrice":40.37,"sellPrice":100.53,"profit":60.16,"multi":2.49,"saleDate":"19/05/2025","receiveDate":"10/06/2025","createdAt":"2025-05-19T00:00:00.000Z"},{"id":"s0112","productId":"bottes timberland","buyPrice":17.47,"sellPrice":65.0,"profit":47.53,"multi":3.72,"saleDate":"20/05/2025","receiveDate":"10/06/2025","createdAt":"2025-05-20T00:00:00.000Z"},{"id":"s0113","productId":"nike zoom vapor pro hc","buyPrice":20.0,"sellPrice":45.73,"profit":25.73,"multi":2.29,"saleDate":"20/05/2025","receiveDate":"10/06/2025","createdAt":"2025-05-20T00:00:00.000Z"},{"id":"s0114","productId":"asics gel resoltion 9","buyPrice":25.81,"sellPrice":50.54,"profit":24.73,"multi":1.96,"saleDate":"19/05/2025","receiveDate":"12/06/2025","createdAt":"2025-05-19T00:00:00.000Z"},{"id":"s0115","productId":"adidas samba","buyPrice":14.79,"sellPrice":49.75,"profit":34.96,"multi":3.36,"saleDate":"19/05/2025","receiveDate":"10/06/2025","createdAt":"2025-05-19T00:00:00.000Z"},{"id":"s0116","productId":"asics gel resoltion 9","buyPrice":29.97,"sellPrice":55.55,"profit":25.58,"multi":1.85,"saleDate":"21/05/2025","receiveDate":"10/06/2025","createdAt":"2025-05-21T00:00:00.000Z"},{"id":"s0117","productId":"course apied nike zoomx streakfly","buyPrice":1.0,"sellPrice":30.7,"profit":29.7,"multi":30.7,"saleDate":"21/05/2025","receiveDate":"17/06/2025","createdAt":"2025-05-21T00:00:00.000Z"},{"id":"s0118","productId":"asics gel resoltion 9","buyPrice":21.64,"sellPrice":50.53,"profit":28.89,"multi":2.34,"saleDate":"22/05/2025","receiveDate":"17/06/2025","createdAt":"2025-05-22T00:00:00.000Z"},{"id":"s0119","productId":"nike zoom fly 3","buyPrice":9.68,"sellPrice":25.45,"profit":15.77,"multi":2.63,"saleDate":"22/05/2025","receiveDate":"13/06/2025","createdAt":"2025-05-22T00:00:00.000Z"},{"id":"s0120","productId":"nike zoom vapor pro 2 hc","buyPrice":21.17,"sellPrice":48.63,"profit":27.46,"multi":2.3,"saleDate":"22/05/2025","receiveDate":"10/06/2025","createdAt":"2025-05-22T00:00:00.000Z"},{"id":"s0121","productId":"nike p 6000","buyPrice":19.49,"sellPrice":45.9,"profit":26.41,"multi":2.36,"saleDate":"22/05/2025","receiveDate":"19/06/2025","createdAt":"2025-05-22T00:00:00.000Z"},{"id":"s0122","productId":"asics gel resoltion 9","buyPrice":21.83,"sellPrice":50.55,"profit":28.72,"multi":2.32,"saleDate":"23/05/2025","receiveDate":"18/06/2025","createdAt":"2025-05-23T00:00:00.000Z"},{"id":"s0123","productId":"nike air max full black","buyPrice":13.88,"sellPrice":50.0,"profit":36.12,"multi":3.6,"saleDate":"24/05/2025","receiveDate":"15/06/2025","createdAt":"2025-05-24T00:00:00.000Z"},{"id":"s0124","productId":"nike air force 1","buyPrice":11.15,"sellPrice":25.55,"profit":14.4,"multi":2.29,"saleDate":"24/05/2025","receiveDate":"19/06/2025","createdAt":"2025-05-24T00:00:00.000Z"},{"id":"s0125","productId":"asics gel resoltion 9","buyPrice":13.24,"sellPrice":50.63,"profit":37.39,"multi":3.82,"saleDate":"25/05/2025","receiveDate":"13/06/2025","createdAt":"2025-05-25T00:00:00.000Z"},{"id":"s0126","productId":"adidas gazelle","buyPrice":5.55,"sellPrice":29.43,"profit":23.88,"multi":5.3,"saleDate":"25/05/2025","receiveDate":"16/06/2025","createdAt":"2025-05-25T00:00:00.000Z"},{"id":"s0127","productId":"nike p 6000","buyPrice":15.19,"sellPrice":40.53,"profit":25.34,"multi":2.67,"saleDate":"26/05/2025","receiveDate":"16/05/2025","createdAt":"2025-05-26T00:00:00.000Z"},{"id":"s0128","productId":"nike air max 90","buyPrice":12.2,"sellPrice":40.45,"profit":28.25,"multi":3.32,"saleDate":"26/05/2025","receiveDate":"16/06/2025","createdAt":"2025-05-26T00:00:00.000Z"},{"id":"s0129","productId":"Nike zoom vapor pro 2 wmb","buyPrice":26.88,"sellPrice":62.0,"profit":35.12,"multi":2.31,"saleDate":"01/06/2025","receiveDate":"18/06/2025","createdAt":"2025-06-01T00:00:00.000Z"},{"id":"s0130","productId":"New balance 327 indigo","buyPrice":14.79,"sellPrice":40.54,"profit":25.75,"multi":2.74,"saleDate":"27/05/2025","receiveDate":"19/06/2025","createdAt":"2025-05-27T00:00:00.000Z"},{"id":"s0131","productId":"Salomon trail speed cross 3 climateshield","buyPrice":15.53,"sellPrice":55.55,"profit":40.02,"multi":3.58,"saleDate":"30/05/2025","receiveDate":"19/06/2025","createdAt":"2025-05-30T00:00:00.000Z"},{"id":"s0132","productId":"Nike cage 3 beige","buyPrice":19.49,"sellPrice":52.54,"profit":33.05,"multi":2.7,"saleDate":"31/05/2025","receiveDate":"19/06/2025","createdAt":"2025-05-31T00:00:00.000Z"},{"id":"s0133","productId":"Nike P-6000 blanche et noire","buyPrice":21.57,"sellPrice":48.53,"profit":26.96,"multi":2.25,"saleDate":"28/05/2025","receiveDate":"19/06/2025","createdAt":"2025-05-28T00:00:00.000Z"},{"id":"s0134","productId":"Nike zoom vapor pro hc","buyPrice":21.17,"sellPrice":50.0,"profit":28.83,"multi":2.36,"saleDate":"28/05/2025","receiveDate":"20/06/2025","createdAt":"2025-05-28T00:00:00.000Z"},{"id":"s0135","productId":"Hoka Clifton 8","buyPrice":8.67,"sellPrice":20.63,"profit":11.96,"multi":2.38,"saleDate":"31/05/2025","receiveDate":"20/06/2025","createdAt":"2025-05-31T00:00:00.000Z"},{"id":"s0136","productId":"Asics gel nyc noires","buyPrice":27.42,"sellPrice":66.57,"profit":39.15,"multi":2.43,"saleDate":"03/06/2025","receiveDate":"23/06/2025","createdAt":"2025-06-03T00:00:00.000Z"},{"id":"s0137","productId":"Nike zoom vapor pro hc 2","buyPrice":23.11,"sellPrice":45.63,"profit":22.52,"multi":1.97,"saleDate":"04/06/2025","receiveDate":"23/06/2025","createdAt":"2025-06-04T00:00:00.000Z"},{"id":"s0138","productId":"asics gel resoltion 9 hugo boss","buyPrice":29.97,"sellPrice":60.71,"profit":30.74,"multi":2.03,"saleDate":"03/06/2025","receiveDate":"27/06/2025","createdAt":"2025-06-03T00:00:00.000Z"},{"id":"s0139","productId":"Nike zoom vapor pro 2 hc beige","buyPrice":21.035,"sellPrice":38.73,"profit":17.69,"multi":1.84,"saleDate":"03/06/2025","receiveDate":"24/06/2025","createdAt":"2025-06-03T00:00:00.000Z"},{"id":"s0140","productId":"Nike gt cut academiy","buyPrice":20.53,"sellPrice":49.34,"profit":28.81,"multi":2.4,"saleDate":"01/06/2025","receiveDate":"25/06/2025","createdAt":"2025-06-01T00:00:00.000Z"},{"id":"s0141","productId":"New balance fresh foam X Hierro v8","buyPrice":15.13,"sellPrice":40.71,"profit":25.58,"multi":2.69,"saleDate":"03/06/2025","receiveDate":"24/06/2025","createdAt":"2025-06-03T00:00:00.000Z"},{"id":"s0142","productId":"Nike zoom vapor pro hc orange","buyPrice":8.03,"sellPrice":30.71,"profit":22.68,"multi":3.82,"saleDate":"16/05/2025","receiveDate":"24/06/2025","createdAt":"2025-05-16T00:00:00.000Z"},{"id":"s0143","productId":"Air max 95 icons","buyPrice":66.0,"sellPrice":112.6,"profit":46.6,"multi":1.71,"saleDate":"02/06/2025","receiveDate":"24/06/2025","createdAt":"2025-06-02T00:00:00.000Z"},{"id":"s0144","productId":"nike p 6000 rouge gris","buyPrice":25.81,"sellPrice":42.92,"profit":17.11,"multi":1.66,"saleDate":"30/05/2025","receiveDate":"24/06/2025","createdAt":"2025-05-30T00:00:00.000Z"},{"id":"s0145","productId":"Hoka clifton 9","buyPrice":21.14,"sellPrice":50.55,"profit":29.41,"multi":2.39,"saleDate":"03/06/2025","receiveDate":"25/06/2025","createdAt":"2025-06-03T00:00:00.000Z"},{"id":"s0146","productId":"New balance 550","buyPrice":6.59,"sellPrice":35.53,"profit":28.94,"multi":5.39,"saleDate":"03/06/2025","receiveDate":"25/06/2025","createdAt":"2025-06-03T00:00:00.000Z"},{"id":"s0147","productId":"Adidas gazelle grises","buyPrice":9.0,"sellPrice":24.7,"profit":15.7,"multi":2.74,"saleDate":"01/06/2025","receiveDate":"25/06/2025","createdAt":"2025-06-01T00:00:00.000Z"},{"id":"s0148","productId":"Nike zoom vapor pro hc noir","buyPrice":19.2,"sellPrice":53.81,"profit":34.61,"multi":2.8,"saleDate":"29/05/2025","receiveDate":"25/06/2025","createdAt":"2025-05-29T00:00:00.000Z"},{"id":"s0149","productId":"Veste rafa rose indian wells","buyPrice":20.0,"sellPrice":40.0,"profit":20.0,"multi":2.0,"saleDate":"09/06/2025","receiveDate":"26/06/2025","createdAt":"2025-06-09T00:00:00.000Z"},{"id":"s0150","productId":"nike p 6000 rouge gris","buyPrice":26.41,"sellPrice":47.0,"profit":20.59,"multi":1.78,"saleDate":"08/06/2025","receiveDate":"26/06/2025","createdAt":"2025-06-08T00:00:00.000Z"},{"id":"s0151","productId":"Nike zoom cage 3 hc beige rose","buyPrice":18.45,"sellPrice":60.54,"profit":42.09,"multi":3.28,"saleDate":"06/06/2025","receiveDate":"26/06/2025","createdAt":"2025-06-06T00:00:00.000Z"},{"id":"s0152","productId":"nike air max 95 bleu blanc","buyPrice":14.28,"sellPrice":48.55,"profit":34.27,"multi":3.4,"saleDate":"06/06/2025","receiveDate":"26/06/2025","createdAt":"2025-06-06T00:00:00.000Z"},{"id":"s0153","productId":"Adidas spezial","buyPrice":21.39,"sellPrice":45.71,"profit":24.32,"multi":2.14,"saleDate":"05/06/2025","receiveDate":"27/06/2025","createdAt":"2025-06-05T00:00:00.000Z"},{"id":"s0154","productId":"Nike zoom vapor pro 2","buyPrice":48.99,"sellPrice":58.33,"profit":9.34,"multi":1.19,"saleDate":"07/06/2025","receiveDate":"27/06/2025","createdAt":"2025-06-07T00:00:00.000Z"},{"id":"s0155","productId":"Nike zoom vapor 11","buyPrice":9.14,"sellPrice":32.0,"profit":22.86,"multi":3.5,"saleDate":"07/06/2025","receiveDate":"27/06/2025","createdAt":"2025-06-07T00:00:00.000Z"},{"id":"s0156","productId":"Asics court ff 3 djoko bleu","buyPrice":8.0,"sellPrice":15.0,"profit":7.0,"multi":1.88,"saleDate":"08/06/2025","receiveDate":"27/06/2025","createdAt":"2025-06-08T00:00:00.000Z"},{"id":"s0157","productId":"Asics novablast semelles oranges","buyPrice":14.09,"sellPrice":40.55,"profit":26.46,"multi":2.88,"saleDate":"10/06/2025","receiveDate":"27/06/2025","createdAt":"2025-06-10T00:00:00.000Z"},{"id":"s0158","productId":"adidas spezial bleu","buyPrice":22.0,"sellPrice":59.13,"profit":37.13,"multi":2.69,"saleDate":"08/06/2025","receiveDate":"27/06/2025","createdAt":"2025-06-08T00:00:00.000Z"},{"id":"s0159","productId":"Hoka clifton 9 ibiza","buyPrice":21.64,"sellPrice":35.63,"profit":13.99,"multi":1.65,"saleDate":"08/06/2025","receiveDate":"27/06/2025","createdAt":"2025-06-08T00:00:00.000Z"},{"id":"s0160","productId":"Adidas samba blanche","buyPrice":20.0,"sellPrice":45.55,"profit":25.55,"multi":2.28,"saleDate":"09/06/2025","receiveDate":"27/06/2025","createdAt":"2025-06-09T00:00:00.000Z"},{"id":"s0161","productId":"Hoka bondi 8 orange","buyPrice":19.49,"sellPrice":50.71,"profit":31.22,"multi":2.6,"saleDate":"06/06/2025","receiveDate":"27/06/2025","createdAt":"2025-06-06T00:00:00.000Z"},{"id":"s0162","productId":"Nike air force 1","buyPrice":10.0,"sellPrice":25.55,"profit":15.55,"multi":2.56,"saleDate":"09/06/2025","receiveDate":"27/06/2025","createdAt":"2025-06-09T00:00:00.000Z"},{"id":"s0163","productId":"Samba noires","buyPrice":14.78,"sellPrice":45.55,"profit":30.77,"multi":3.08,"saleDate":"09/06/2025","receiveDate":"27/06/2025","createdAt":"2025-06-09T00:00:00.000Z"},{"id":"s0164","productId":"Lot 2 nike vapor pro noires logo orange et asics court ff 3 novak","buyPrice":51.0,"sellPrice":105.54,"profit":54.54,"multi":2.07,"saleDate":"10/06/2025","receiveDate":"27/06/2025","createdAt":"2025-06-10T00:00:00.000Z"},{"id":"s0165","productId":"nike pegasus Nathan bell","buyPrice":23.72,"sellPrice":40.55,"profit":16.83,"multi":1.71,"saleDate":"09/06/2025","receiveDate":"30/06/2025","createdAt":"2025-06-09T00:00:00.000Z"},{"id":"s0166","productId":"nike p 6000 femme","buyPrice":8.92,"sellPrice":45.63,"profit":36.71,"multi":5.12,"saleDate":"08/06/2025","receiveDate":"30/06/2025","createdAt":"2025-06-08T00:00:00.000Z"},{"id":"s0167","productId":"Asics court ff 3 femme","buyPrice":10.0,"sellPrice":35.63,"profit":25.63,"multi":3.56,"saleDate":"09/06/2025","receiveDate":"30/06/2025","createdAt":"2025-06-09T00:00:00.000Z"},{"id":"s0168","productId":"new balance 2002 r violette marron","buyPrice":16.39,"sellPrice":44.9,"profit":28.51,"multi":2.74,"saleDate":"06/06/2025","receiveDate":"30/06/2025","createdAt":"2025-06-06T00:00:00.000Z"},{"id":"s0169","productId":"Nike air max 95 logo rouge full balck","buyPrice":30.4,"sellPrice":73.6,"profit":43.2,"multi":2.42,"saleDate":"08/06/2025","receiveDate":"30/06/2025","createdAt":"2025-06-08T00:00:00.000Z"},{"id":"s0170","productId":"Nike zoom vapor 9.5 tour clay lava glow","buyPrice":13.05,"sellPrice":70.55,"profit":57.5,"multi":5.41,"saleDate":"08/06/2025","receiveDate":"30/06/2025","createdAt":"2025-06-08T00:00:00.000Z"},{"id":"s0171","productId":"Nike initiatior","buyPrice":18.57,"sellPrice":45.63,"profit":27.06,"multi":2.46,"saleDate":"12/06/2025","receiveDate":"30/06/2025","createdAt":"2025-06-12T00:00:00.000Z"},{"id":"s0172","productId":"Nike zoom vapor pro 2 beige bleu","buyPrice":22.0,"sellPrice":50.18,"profit":28.18,"multi":2.28,"saleDate":"06/06/2025","receiveDate":"30/06/2025","createdAt":"2025-06-06T00:00:00.000Z"},{"id":"s0173","productId":"Adidas spezial bleu","buyPrice":20.0,"sellPrice":40.55,"profit":20.55,"multi":2.03,"saleDate":"09/06/2025","receiveDate":"30/06/2025","createdAt":"2025-06-09T00:00:00.000Z"},{"id":"s0174","productId":"Nike zoom vapor pro 2 blanche défoncées","buyPrice":7.0,"sellPrice":13.83,"profit":6.83,"multi":1.98,"saleDate":"10/06/2025","receiveDate":"01/07/2025","createdAt":"2025-06-10T00:00:00.000Z"},{"id":"s0175","productId":"asics gel resoltion 9 padel","buyPrice":25.81,"sellPrice":40.63,"profit":14.82,"multi":1.57,"saleDate":"10/06/2025","receiveDate":"01/07/2025","createdAt":"2025-06-10T00:00:00.000Z"},{"id":"s0176","productId":"adidas gazelle grises","buyPrice":10.0,"sellPrice":25.74,"profit":15.74,"multi":2.57,"saleDate":"10/06/2025","receiveDate":"01/07/2025","createdAt":"2025-06-10T00:00:00.000Z"},{"id":"s0177","productId":"Nike zoom vapor pro hc orange","buyPrice":32.47,"sellPrice":66.63,"profit":34.16,"multi":2.05,"saleDate":"12/06/2025","receiveDate":"01/07/2025","createdAt":"2025-06-12T00:00:00.000Z"},{"id":"s0178","productId":"Asics resoltion 8 padel bleu marine","buyPrice":12.01,"sellPrice":40.71,"profit":28.7,"multi":3.39,"saleDate":"09/06/2025","receiveDate":"01/07/2025","createdAt":"2025-06-09T00:00:00.000Z"},{"id":"s0179","productId":"Nike zoom vapor pro clay","buyPrice":28.93,"sellPrice":50.71,"profit":21.78,"multi":1.75,"saleDate":"08/06/2025","receiveDate":"01/07/2025","createdAt":"2025-06-08T00:00:00.000Z"},{"id":"s0180","productId":"asics gel resoltion 9","buyPrice":14.35,"sellPrice":33.0,"profit":18.65,"multi":2.3,"saleDate":"07/06/2025","receiveDate":"01/07/2025","createdAt":"2025-06-07T00:00:00.000Z"},{"id":"s0181","productId":"nike p-6000","buyPrice":15.96,"sellPrice":37.63,"profit":21.67,"multi":2.36,"saleDate":"11/06/2025","receiveDate":"01/07/2025","createdAt":"2025-06-11T00:00:00.000Z"},{"id":"s0182","productId":"New balance 2002 r noires","buyPrice":14.09,"sellPrice":45.55,"profit":31.46,"multi":3.23,"saleDate":"15/06/2025","receiveDate":"02/07/2025","createdAt":"2025-06-15T00:00:00.000Z"},{"id":"s0183","productId":"Nike initiator","buyPrice":9.07,"sellPrice":33.63,"profit":24.56,"multi":3.71,"saleDate":"15/06/2025","receiveDate":"02/07/2025","createdAt":"2025-06-15T00:00:00.000Z"},{"id":"s0184","productId":"new balance 2002 r","buyPrice":24.51,"sellPrice":50.55,"profit":26.04,"multi":2.06,"saleDate":"15/06/2025","receiveDate":"02/07/2025","createdAt":"2025-06-15T00:00:00.000Z"},{"id":"s0185","productId":"adidas samba","buyPrice":20.0,"sellPrice":38.63,"profit":18.63,"multi":1.93,"saleDate":"11/06/2025","receiveDate":"02/07/2025","createdAt":"2025-06-11T00:00:00.000Z"},{"id":"s0186","productId":"Nike pegasus 40 SE","buyPrice":19.49,"sellPrice":40.74,"profit":21.25,"multi":2.09,"saleDate":"13/06/2025","receiveDate":"03/07/2025","createdAt":"2025-06-13T00:00:00.000Z"},{"id":"s0187","productId":"Nike zoom fly 5","buyPrice":16.45,"sellPrice":55.71,"profit":39.26,"multi":3.39,"saleDate":"14/06/2025","receiveDate":"04/07/2025","createdAt":"2025-06-14T00:00:00.000Z"},{"id":"s0188","productId":"New balance fresh foam X 880v12","buyPrice":14.28,"sellPrice":43.18,"profit":28.9,"multi":3.02,"saleDate":"08/06/2025","receiveDate":"04/07/2025","createdAt":"2025-06-08T00:00:00.000Z"},{"id":"s0189","productId":"Asics court ff 3 clay novak","buyPrice":38.945,"sellPrice":86.71,"profit":47.76,"multi":2.23,"saleDate":"15/06/2025","receiveDate":"04/07/2025","createdAt":"2025-06-15T00:00:00.000Z"},{"id":"s0190","productId":"Lot 3 articles nike vapor pro 2 Wimbledon chaussures defoncer vapor et vapor pro 2 jaunis","buyPrice":53.0,"sellPrice":95.73,"profit":42.73,"multi":1.81,"saleDate":"17/06/2025","receiveDate":"04/07/2025","createdAt":"2025-06-17T00:00:00.000Z"},{"id":"s0191","productId":"Nike gt 2000 je me suis trompe j’ai mis nimbus","buyPrice":13.31,"sellPrice":35.54,"profit":22.23,"multi":2.67,"saleDate":"13/06/2025","receiveDate":"04/07/2025","createdAt":"2025-06-13T00:00:00.000Z"},{"id":"s0192","productId":"Lot 4 articles nike vapor pro hc blanche nike vapor pro hc bleu hoka bondi 8 jaune nike pegasus 36","buyPrice":63.9,"sellPrice":200.76,"profit":136.86,"multi":3.14,"saleDate":"16/06/2025","receiveDate":"07/07/2025","createdAt":"2025-06-16T00:00:00.000Z"},{"id":"s0193","productId":"New balance fuel cell supercomputer trail","buyPrice":20.4,"sellPrice":59.63,"profit":39.23,"multi":2.92,"saleDate":"18/06/2025","receiveDate":"07/07/2025","createdAt":"2025-06-18T00:00:00.000Z"},{"id":"s0194","productId":"Asics gel resoltion 9 padel","buyPrice":22.0,"sellPrice":50.63,"profit":28.63,"multi":2.3,"saleDate":"14/06/2025","receiveDate":"07/07/2025","createdAt":"2025-06-14T00:00:00.000Z"},{"id":"s0195","productId":"adidas samba blanches","buyPrice":20.0,"sellPrice":45.53,"profit":25.53,"multi":2.28,"saleDate":"17/06/2025","receiveDate":"07/07/2025","createdAt":"2025-06-17T00:00:00.000Z"},{"id":"s0196","productId":"Adidas samba beige","buyPrice":17.0,"sellPrice":47.33,"profit":30.33,"multi":2.78,"saleDate":"18/06/2025","receiveDate":"07/07/2025","createdAt":"2025-06-18T00:00:00.000Z"},{"id":"s0197","productId":"Nike air jordan 3 red white","buyPrice":15.19,"sellPrice":43.25,"profit":28.06,"multi":2.85,"saleDate":"10/06/2025","receiveDate":"07/07/2025","createdAt":"2025-06-10T00:00:00.000Z"},{"id":"s0198","productId":"Adidas spezial noires","buyPrice":24.8,"sellPrice":50.82,"profit":26.02,"multi":2.05,"saleDate":"17/06/2025","receiveDate":"07/07/2025","createdAt":"2025-06-17T00:00:00.000Z"},{"id":"s0199","productId":"adidas spezial bleu","buyPrice":24.0,"sellPrice":50.53,"profit":26.53,"multi":2.11,"saleDate":"18/06/2025","receiveDate":"07/07/2025","createdAt":"2025-06-18T00:00:00.000Z"},{"id":"s0200","productId":"Asics gel nyc","buyPrice":25.49,"sellPrice":55.55,"profit":30.06,"multi":2.18,"saleDate":"17/06/2025","receiveDate":"08/07/2025","createdAt":"2025-06-17T00:00:00.000Z"},{"id":"s0201","productId":"adidas samba blanches","buyPrice":20.0,"sellPrice":40.92,"profit":20.92,"multi":2.05,"saleDate":"13/06/2025","receiveDate":"08/07/2025","createdAt":"2025-06-13T00:00:00.000Z"},{"id":"s0202","productId":"Asics court ff 3 novak Djokovic rouge","buyPrice":15.505,"sellPrice":40.55,"profit":25.04,"multi":2.62,"saleDate":"19/06/2025","receiveDate":"08/07/2025","createdAt":"2025-06-19T00:00:00.000Z"},{"id":"s0203","productId":"On running cloud monster","buyPrice":20.19,"sellPrice":75.82,"profit":55.63,"multi":3.76,"saleDate":"18/06/0225","receiveDate":"08/07/2025","createdAt":"0225-06-18T00:00:00.000Z"},{"id":"s0204","productId":"nike initiator","buyPrice":19.36,"sellPrice":40.92,"profit":21.56,"multi":2.11,"saleDate":"12/06/2025","receiveDate":"08/07/2025","createdAt":"2025-06-12T00:00:00.000Z"},{"id":"s0205","productId":"adidas samba noires","buyPrice":17.21,"sellPrice":50.0,"profit":32.79,"multi":2.91,"saleDate":"21/06/2025","receiveDate":"09/07/2025","createdAt":"2025-06-21T00:00:00.000Z"},{"id":"s0206","productId":"Nike zoom vapor pro 2 hc","buyPrice":21.035,"sellPrice":45.54,"profit":24.5,"multi":2.16,"saleDate":"20/06/2025","receiveDate":"09/07/2025","createdAt":"2025-06-20T00:00:00.000Z"},{"id":"s0207","productId":"adidas samba blanches","buyPrice":19.0,"sellPrice":53.73,"profit":34.73,"multi":2.83,"saleDate":"21/06/2025","receiveDate":"09/07/2025","createdAt":"2025-06-21T00:00:00.000Z"},{"id":"s0208","productId":"adidas samba","buyPrice":17.27,"sellPrice":44.53,"profit":27.26,"multi":2.58,"saleDate":"16/06/2025","receiveDate":"10/07/2025","createdAt":"2025-06-16T00:00:00.000Z"},{"id":"s0209","productId":"Casque gaming xbox","buyPrice":13.85,"sellPrice":30.63,"profit":16.78,"multi":2.21,"saleDate":"21/06/2025","receiveDate":"10/07/2025","createdAt":"2025-06-21T00:00:00.000Z"},{"id":"s0210","productId":"Nike zoom vapor pro hc","buyPrice":20.0,"sellPrice":43.13,"profit":23.13,"multi":2.16,"saleDate":"21/06/2025","receiveDate":"10/07/2025","createdAt":"2025-06-21T00:00:00.000Z"},{"id":"s0211","productId":"adidas samba","buyPrice":14.08,"sellPrice":41.45,"profit":27.37,"multi":2.94,"saleDate":"18/06/2025","receiveDate":"10/07/2025","createdAt":"2025-06-18T00:00:00.000Z"},{"id":"s0212","productId":"asics gel résolution 9","buyPrice":17.47,"sellPrice":40.63,"profit":23.16,"multi":2.33,"saleDate":"21/06/2025","receiveDate":"10/07/2025","createdAt":"2025-06-21T00:00:00.000Z"},{"id":"s0213","productId":"adidas spezial","buyPrice":20.34,"sellPrice":45.55,"profit":25.21,"multi":2.24,"saleDate":"21/06/2025","receiveDate":"10/07/2025","createdAt":"2025-06-21T00:00:00.000Z"},{"id":"s0214","productId":"adidas spezial","buyPrice":20.0,"sellPrice":50.55,"profit":30.55,"multi":2.53,"saleDate":"21/06/2025","receiveDate":"10/07/2025","createdAt":"2025-06-21T00:00:00.000Z"},{"id":"s0215","productId":"adidas spezial","buyPrice":19.0,"sellPrice":40.63,"profit":21.63,"multi":2.14,"saleDate":"22/06/2025","receiveDate":"10/07/2025","createdAt":"2025-06-22T00:00:00.000Z"},{"id":"s0216","productId":"adidas spezial","buyPrice":25.61,"sellPrice":54.63,"profit":29.02,"multi":2.13,"saleDate":"21/06/2025","receiveDate":"10/07/2025","createdAt":"2025-06-21T00:00:00.000Z"},{"id":"s0217","productId":"adidas spezial","buyPrice":15.09,"sellPrice":47.63,"profit":32.54,"multi":3.16,"saleDate":"22/06/2025","receiveDate":"10/07/2025","createdAt":"2025-06-22T00:00:00.000Z"},{"id":"s0218","productId":"Nike zoom vapor pro clay","buyPrice":32.47,"sellPrice":59.47,"profit":27.0,"multi":1.83,"saleDate":"25/06/2025","receiveDate":"11/07/2025","createdAt":"2025-06-25T00:00:00.000Z"},{"id":"s0219","productId":"adidas spezial","buyPrice":26.01,"sellPrice":51.85,"profit":25.84,"multi":1.99,"saleDate":"20/06/2025","receiveDate":"11/07/2025","createdAt":"2025-06-20T00:00:00.000Z"},{"id":"s0220","productId":"Hoka bondi 8","buyPrice":19.3,"sellPrice":65.63,"profit":46.33,"multi":3.4,"saleDate":"21/06/2025","receiveDate":"11/07/2025","createdAt":"2025-06-21T00:00:00.000Z"},{"id":"s0221","productId":"adidas samba","buyPrice":15.0,"sellPrice":45.55,"profit":30.55,"multi":3.04,"saleDate":"18/06/2025","receiveDate":"11/07/2025","createdAt":"2025-06-18T00:00:00.000Z"},{"id":"s0222","productId":"adidas samba","buyPrice":19.48,"sellPrice":48.41,"profit":28.93,"multi":2.49,"saleDate":"21/06/2025","receiveDate":"14/07/2025","createdAt":"2025-06-21T00:00:00.000Z"},{"id":"s0223","productId":"adidas spezial","buyPrice":24.51,"sellPrice":40.53,"profit":16.02,"multi":1.65,"saleDate":"22/06/2025","receiveDate":"14/07/2025","createdAt":"2025-06-22T00:00:00.000Z"},{"id":"s0224","productId":"Nike zoom vapor pro","buyPrice":26.0,"sellPrice":55.73,"profit":29.73,"multi":2.14,"saleDate":"23/06/2025","receiveDate":"15/07/2025","createdAt":"2025-06-23T00:00:00.000Z"},{"id":"s0225","productId":"adidas spezial taille","buyPrice":24.15,"sellPrice":51.45,"profit":27.3,"multi":2.13,"saleDate":"25/06/2025","receiveDate":"15/07/2025","createdAt":"2025-06-25T00:00:00.000Z"},{"id":"s0226","productId":"Asics gel dedicate 8","buyPrice":9.77,"sellPrice":30.63,"profit":20.86,"multi":3.14,"saleDate":"22/06/2025","receiveDate":"15/07/2025","createdAt":"2025-06-22T00:00:00.000Z"},{"id":"s0227","productId":"Asics gel resoltion","buyPrice":10.96,"sellPrice":20.68,"profit":9.72,"multi":1.89,"saleDate":"22/06/2025","receiveDate":"15/07/2025","createdAt":"2025-06-22T00:00:00.000Z"},{"id":"s0228","productId":"Lot 2 article nova blast 3 et Clifton 8","buyPrice":55.71,"sellPrice":105.73,"profit":50.02,"multi":1.9,"saleDate":"25/06/2025","receiveDate":"15/07/2025","createdAt":"2025-06-25T00:00:00.000Z"},{"id":"s0229","productId":"asics gel resoltion 9","buyPrice":17.76,"sellPrice":39.63,"profit":21.87,"multi":2.23,"saleDate":"25/06/2025","receiveDate":"15/07/2025","createdAt":"2025-06-25T00:00:00.000Z"},{"id":"s0230","productId":"adidas spezial","buyPrice":25.31,"sellPrice":49.55,"profit":24.24,"multi":1.96,"saleDate":"20/06/2025","receiveDate":"15/07/2025","createdAt":"2025-06-20T00:00:00.000Z"},{"id":"s0231","productId":"Lot samba noires blanches","buyPrice":39.67,"sellPrice":77.25,"profit":37.58,"multi":1.95,"saleDate":"25/06/2025","receiveDate":"18/07/2025","createdAt":"2025-06-25T00:00:00.000Z"},{"id":"s0232","productId":"Rafa cage 4 clay","buyPrice":26.35,"sellPrice":58.55,"profit":32.2,"multi":2.22,"saleDate":"28/06/2025","receiveDate":"18/07/2025","createdAt":"2025-06-28T00:00:00.000Z"},{"id":"s0233","productId":"adidas samba","buyPrice":20.4,"sellPrice":47.74,"profit":27.34,"multi":2.34,"saleDate":"29/06/2025","receiveDate":"18/07/2025","createdAt":"2025-06-29T00:00:00.000Z"},{"id":"s0234","productId":"Nike jordan 3","buyPrice":14.82,"sellPrice":55.53,"profit":40.71,"multi":3.75,"saleDate":"29/09/2025","receiveDate":"21/07/2025","createdAt":"2025-09-29T00:00:00.000Z"},{"id":"s0235","productId":"Puma velocity","buyPrice":12.7,"sellPrice":37.7,"profit":25.0,"multi":2.97,"saleDate":"28/06/2025","receiveDate":"21/07/2025","createdAt":"2025-06-28T00:00:00.000Z"},{"id":"s0236","productId":"Adidas gazelle","buyPrice":11.22,"sellPrice":20.63,"profit":9.41,"multi":1.84,"saleDate":"02/07/2025","receiveDate":"21/07/2025","createdAt":"2025-07-02T00:00:00.000Z"},{"id":"s0237","productId":"On running cloud roam waterproof","buyPrice":25.61,"sellPrice":65.63,"profit":40.02,"multi":2.56,"saleDate":"04/07/2025","receiveDate":"22/07/2025","createdAt":"2025-07-04T00:00:00.000Z"},{"id":"s0238","productId":"Moka Clifton 8","buyPrice":21.64,"sellPrice":48.33,"profit":26.69,"multi":2.23,"saleDate":"29/06/2025","receiveDate":"22/07/2025","createdAt":"2025-06-29T00:00:00.000Z"},{"id":"s0239","productId":"asics court ff 3 clay","buyPrice":7.62,"sellPrice":25.54,"profit":17.92,"multi":3.35,"saleDate":"24/06/2025","receiveDate":"22/07/2025","createdAt":"2025-06-24T00:00:00.000Z"},{"id":"s0240","productId":"Salomon speed cross 3","buyPrice":25.61,"sellPrice":53.55,"profit":27.94,"multi":2.09,"saleDate":"02/07/2025","receiveDate":"22/07/2025","createdAt":"2025-07-02T00:00:00.000Z"},{"id":"s0241","productId":"New balance 2002 r","buyPrice":24.51,"sellPrice":58.15,"profit":33.64,"multi":2.37,"saleDate":"02/07/2025","receiveDate":"22/07/2025","createdAt":"2025-07-02T00:00:00.000Z"},{"id":"s0242","productId":"Nike air zoom vapor X federer","buyPrice":24.51,"sellPrice":60.55,"profit":36.04,"multi":2.47,"saleDate":"04/07/2025","receiveDate":"22/07/2025","createdAt":"2025-07-04T00:00:00.000Z"},{"id":"s0243","productId":"Nike zoom vapor pro","buyPrice":16.27,"sellPrice":55.63,"profit":39.36,"multi":3.42,"saleDate":"06/07/2025","receiveDate":"23/07/2025","createdAt":"2025-07-06T00:00:00.000Z"},{"id":"s0244","productId":"nike zoom vapor pro","buyPrice":17.87,"sellPrice":40.63,"profit":22.76,"multi":2.27,"saleDate":"28/06/2025","receiveDate":"23/07/2025","createdAt":"2025-06-28T00:00:00.000Z"},{"id":"s0245","productId":"adidas samba","buyPrice":18.44,"sellPrice":47.3,"profit":28.86,"multi":2.57,"saleDate":"03/07/2025","receiveDate":"23/07/2025","createdAt":"2025-07-03T00:00:00.000Z"},{"id":"s0246","productId":"asics court ff 3 novak","buyPrice":26.85,"sellPrice":55.53,"profit":28.68,"multi":2.07,"saleDate":"02/07/2025","receiveDate":"23/07/2025","createdAt":"2025-07-02T00:00:00.000Z"},{"id":"s0247","productId":"adidas spezial","buyPrice":17.27,"sellPrice":50.55,"profit":33.28,"multi":2.93,"saleDate":"02/07/2025","receiveDate":"24/07/2025","createdAt":"2025-07-02T00:00:00.000Z"},{"id":"s0248","productId":"On running cloud monster","buyPrice":17.87,"sellPrice":50.8,"profit":32.93,"multi":2.84,"saleDate":"06/07/2025","receiveDate":"24/07/2025","createdAt":"2025-07-06T00:00:00.000Z"},{"id":"s0249","productId":"Asisc gel tarbuco  9","buyPrice":22.18,"sellPrice":57.63,"profit":35.45,"multi":2.6,"saleDate":"07/07/2025","receiveDate":"24/07/2025","createdAt":"2025-07-07T00:00:00.000Z"},{"id":"s0250","productId":"Asics court ff 2 clay","buyPrice":46.14,"sellPrice":93.63,"profit":47.49,"multi":2.03,"saleDate":"04/07/2025","receiveDate":"24/07/2025","createdAt":"2025-07-04T00:00:00.000Z"},{"id":"s0251","productId":"new balance 2002 r","buyPrice":25.78,"sellPrice":62.43,"profit":36.65,"multi":2.42,"saleDate":"04/07/2025","receiveDate":"24/07/2025","createdAt":"2025-07-04T00:00:00.000Z"},{"id":"s0252","productId":"Chaussures roger federer on running","buyPrice":19.3,"sellPrice":40.87,"profit":21.57,"multi":2.12,"saleDate":"08/07/2025","receiveDate":"25/07/2025","createdAt":"2025-07-08T00:00:00.000Z"},{"id":"s0253","productId":"Nike zoom cage 3","buyPrice":18.96,"sellPrice":38.63,"profit":19.67,"multi":2.04,"saleDate":"08/07/2025","receiveDate":"25/07/2025","createdAt":"2025-07-08T00:00:00.000Z"},{"id":"s0254","productId":"adidas spezial","buyPrice":20.1,"sellPrice":49.71,"profit":29.61,"multi":2.47,"saleDate":"05/07/2025","receiveDate":"25/07/2025","createdAt":"2025-07-05T00:00:00.000Z"},{"id":"s0255","productId":"Nike zoom vapor pro","buyPrice":20.4,"sellPrice":50.11,"profit":29.71,"multi":2.46,"saleDate":"06/07/2025","receiveDate":"28/07/2025","createdAt":"2025-07-06T00:00:00.000Z"},{"id":"s0256","productId":"Asics gel resolution 9 clay","buyPrice":34.92,"sellPrice":84.71,"profit":49.79,"multi":2.43,"saleDate":"07/07/2025","receiveDate":"29/07/2025","createdAt":"2025-07-07T00:00:00.000Z"},{"id":"s0257","productId":"adidas spezial","buyPrice":24.51,"sellPrice":49.15,"profit":24.64,"multi":2.01,"saleDate":"10/07/2025","receiveDate":"30/07/2025","createdAt":"2025-07-10T00:00:00.000Z"},{"id":"s0258","productId":"Asics gel resolution X","buyPrice":28.53,"sellPrice":100.63,"profit":72.1,"multi":3.53,"saleDate":"12/07/2025","receiveDate":"31/07/2025","createdAt":"2025-07-12T00:00:00.000Z"},{"id":"s0259","productId":"adidas samba","buyPrice":15.76,"sellPrice":48.63,"profit":32.87,"multi":3.09,"saleDate":"10/07/2025","receiveDate":"31/07/2025","createdAt":"2025-07-10T00:00:00.000Z"},{"id":"s0260","productId":"Lot 2 Adidas","buyPrice":42.5,"sellPrice":87.63,"profit":45.13,"multi":2.06,"saleDate":"14/07/2025","receiveDate":"01/08/2025","createdAt":"2025-07-14T00:00:00.000Z"},{"id":"s0261","productId":"adidas spezial","buyPrice":22.89,"sellPrice":51.85,"profit":28.96,"multi":2.27,"saleDate":"14/07/2025","receiveDate":"01/08/2025","createdAt":"2025-07-14T00:00:00.000Z"},{"id":"s0262","productId":"New balance 1906 r","buyPrice":24.7,"sellPrice":56.53,"profit":31.83,"multi":2.29,"saleDate":"14/07/2025","receiveDate":"01/08/2025","createdAt":"2025-07-14T00:00:00.000Z"},{"id":"s0263","productId":"adidas samba","buyPrice":17.27,"sellPrice":48.78,"profit":31.51,"multi":2.82,"saleDate":"06/07/2025","receiveDate":"01/08/2025","createdAt":"2025-07-06T00:00:00.000Z"},{"id":"s0264","productId":"Asics gel resolution 9","buyPrice":14.28,"sellPrice":35.63,"profit":21.35,"multi":2.5,"saleDate":"14/07/2025","receiveDate":"01/08/2025","createdAt":"2025-07-14T00:00:00.000Z"},{"id":"s0265","productId":"Onitsuka tiger","buyPrice":24.89,"sellPrice":64.63,"profit":39.74,"multi":2.6,"saleDate":"15/07/2025","receiveDate":"04/08/2025","createdAt":"2025-07-15T00:00:00.000Z"},{"id":"s0266","productId":"On running Roger pro","buyPrice":36.02,"sellPrice":82.55,"profit":46.53,"multi":2.29,"saleDate":"10/07/2025","receiveDate":"10/08/2025","createdAt":"2025-07-10T00:00:00.000Z"},{"id":"s0267","productId":"Adidas samba","buyPrice":23.35,"sellPrice":50.55,"profit":27.2,"multi":2.16,"saleDate":"13/07/2025","receiveDate":"06/08/2025","createdAt":"2025-07-13T00:00:00.000Z"},{"id":"s0268","productId":"adidas campus","buyPrice":13.57,"sellPrice":34.7,"profit":21.13,"multi":2.56,"saleDate":"09/07/2025","receiveDate":"04/08/2025","createdAt":"2025-07-09T00:00:00.000Z"},{"id":"s0269","productId":"Adidas samba","buyPrice":17.35,"sellPrice":46.21,"profit":28.86,"multi":2.66,"saleDate":"13/07/2025","receiveDate":"05/08/2025","createdAt":"2025-07-13T00:00:00.000Z"},{"id":"s0270","productId":"New balance 574","buyPrice":12.35,"sellPrice":30.0,"profit":17.65,"multi":2.43,"saleDate":"13/07/2025","receiveDate":"04/08/2025","createdAt":"2025-07-13T00:00:00.000Z"},{"id":"s0271","productId":"114","buyPrice":12.35,"sellPrice":58.55,"profit":46.2,"multi":4.74,"saleDate":"16/07/2025","receiveDate":"05/08/2025","createdAt":"2025-07-16T00:00:00.000Z"},{"id":"s0272","productId":"Nike show r 4","buyPrice":25.61,"sellPrice":56.71,"profit":31.1,"multi":2.21,"saleDate":"09/07/2025","receiveDate":"06/08/2025","createdAt":"2025-07-09T00:00:00.000Z"},{"id":"s0273","productId":"171","buyPrice":20.64,"sellPrice":50.63,"profit":29.99,"multi":2.45,"saleDate":"19/07/2025","receiveDate":"06/08/2025","createdAt":"2025-07-19T00:00:00.000Z"},{"id":"s0274","productId":"Asics nimbus","buyPrice":13.31,"sellPrice":55.08,"profit":41.77,"multi":4.14,"saleDate":"09/07/2025","receiveDate":"07/08/2025","createdAt":"2025-07-09T00:00:00.000Z"},{"id":"s0275","productId":"172","buyPrice":10.14,"sellPrice":30.42,"profit":20.28,"multi":3.0,"saleDate":"18/07/2025","receiveDate":"07/08/2025","createdAt":"2025-07-18T00:00:00.000Z"},{"id":"s0276","productId":"177","buyPrice":26.85,"sellPrice":58.54,"profit":31.69,"multi":2.18,"saleDate":"19/07/2025","receiveDate":"08/08/2025","createdAt":"2025-07-19T00:00:00.000Z"},{"id":"s0277","productId":"85","buyPrice":30.4,"sellPrice":70.63,"profit":40.23,"multi":2.32,"saleDate":"20/07/2025","receiveDate":"08/08/2025","createdAt":"2025-07-20T00:00:00.000Z"},{"id":"s0278","productId":"56 et 34","buyPrice":35.69,"sellPrice":65.68,"profit":29.99,"multi":1.84,"saleDate":"15/07/2025","receiveDate":"08/08/2025","createdAt":"2025-07-15T00:00:00.000Z"},{"id":"s0279","productId":"141","buyPrice":25.61,"sellPrice":65.54,"profit":39.93,"multi":2.56,"saleDate":"20/07/2025","receiveDate":"08/08/2025","createdAt":"2025-07-20T00:00:00.000Z"},{"id":"s0280","productId":"180","buyPrice":9.68,"sellPrice":24.63,"profit":14.95,"multi":2.54,"saleDate":"20/07/2025","receiveDate":"11/08/2025","createdAt":"2025-07-20T00:00:00.000Z"},{"id":"s0281","productId":"175","buyPrice":21.24,"sellPrice":65.7,"profit":44.46,"multi":3.09,"saleDate":"18/07/2025","receiveDate":"11/08/2025","createdAt":"2025-07-18T00:00:00.000Z"},{"id":"s0282","productId":"178","buyPrice":28.73,"sellPrice":70.63,"profit":41.9,"multi":2.46,"saleDate":"21/07/2025","receiveDate":"11/08/2025","createdAt":"2025-07-21T00:00:00.000Z"},{"id":"s0283","productId":"on running roger pro","buyPrice":21.38,"sellPrice":25.74,"profit":4.36,"multi":1.2,"saleDate":"22/07/2025","receiveDate":"11/08/2025","createdAt":"2025-07-22T00:00:00.000Z"},{"id":"s0284","productId":"179","buyPrice":25.81,"sellPrice":57.71,"profit":31.9,"multi":2.24,"saleDate":"20/07/2025","receiveDate":"12/08/2025","createdAt":"2025-07-20T00:00:00.000Z"},{"id":"s0285","productId":"nike zoom vapor pro","buyPrice":24.51,"sellPrice":81.71,"profit":57.2,"multi":3.33,"saleDate":"19/07/2025","receiveDate":"12/08/2025","createdAt":"2025-07-19T00:00:00.000Z"},{"id":"s0286","productId":"nike zoom vapor pro hc","buyPrice":14.28,"sellPrice":46.63,"profit":32.35,"multi":3.27,"saleDate":"24/07/2025","receiveDate":"12/08/2025","createdAt":"2025-07-24T00:00:00.000Z"},{"id":"s0287","productId":"163 et 198","buyPrice":35.13,"sellPrice":90.63,"profit":55.5,"multi":2.58,"saleDate":"23/07/2025","receiveDate":"13/08/2025","createdAt":"2025-07-23T00:00:00.000Z"},{"id":"s0288","productId":"20","buyPrice":24.7,"sellPrice":38.53,"profit":13.83,"multi":1.56,"saleDate":"23/07/2025","receiveDate":"13/08/2025","createdAt":"2025-07-23T00:00:00.000Z"},{"id":"s0289","productId":"Nike shox turbo","buyPrice":25.81,"sellPrice":67.9,"profit":42.09,"multi":2.63,"saleDate":"26/07/2025","receiveDate":"14/08/2025","createdAt":"2025-07-26T00:00:00.000Z"},{"id":"s0290","productId":"40","buyPrice":10.18,"sellPrice":30.74,"profit":20.56,"multi":3.02,"saleDate":"25/07/2025","receiveDate":"14/08/2025","createdAt":"2025-07-25T00:00:00.000Z"},{"id":"s0291","productId":"17","buyPrice":25.31,"sellPrice":59.55,"profit":34.24,"multi":2.35,"saleDate":"26/07/2025","receiveDate":"14/08/2025","createdAt":"2025-07-26T00:00:00.000Z"},{"id":"s0292","productId":"248","buyPrice":13.88,"sellPrice":46.6,"profit":32.72,"multi":3.36,"saleDate":"09/08/2025","receiveDate":"16/08/2025","createdAt":"2025-08-09T00:00:00.000Z"},{"id":"s0293","productId":"188","buyPrice":28.71,"sellPrice":65.55,"profit":36.84,"multi":2.28,"saleDate":"25/07/2025","receiveDate":"18/08/2025","createdAt":"2025-07-25T00:00:00.000Z"},{"id":"s0294","productId":"43","buyPrice":20.24,"sellPrice":74.63,"profit":54.39,"multi":3.69,"saleDate":"26/07/2025","receiveDate":"18/08/2025","createdAt":"2025-07-26T00:00:00.000Z"},{"id":"s0295","productId":"230","buyPrice":22.27,"sellPrice":55.71,"profit":33.44,"multi":2.5,"saleDate":"11/08/2025","receiveDate":"18/08/2025","createdAt":"2025-08-11T00:00:00.000Z"},{"id":"s0296","productId":"117 et 122","buyPrice":51.32,"sellPrice":110.63,"profit":59.31,"multi":2.16,"saleDate":"26/07/2025","receiveDate":"18/08/2025","createdAt":"2025-07-26T00:00:00.000Z"},{"id":"s0297","productId":"191","buyPrice":19.73,"sellPrice":55.9,"profit":36.17,"multi":2.83,"saleDate":"24/07/2025","receiveDate":"18/08/2025","createdAt":"2025-07-24T00:00:00.000Z"},{"id":"s0298","productId":"15","buyPrice":19.49,"sellPrice":55.63,"profit":36.14,"multi":2.85,"saleDate":"29/07/2025","receiveDate":"20/08/2025","createdAt":"2025-07-29T00:00:00.000Z"},{"id":"s0299","productId":"159","buyPrice":20.64,"sellPrice":51.93,"profit":31.29,"multi":2.52,"saleDate":"30/07/2025","receiveDate":"20/08/2025","createdAt":"2025-07-30T00:00:00.000Z"},{"id":"s0300","productId":"247","buyPrice":24.89,"sellPrice":80.0,"profit":55.11,"multi":3.21,"saleDate":"04/08/2025","receiveDate":"20/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0301","productId":"60","buyPrice":19.3,"sellPrice":58.63,"profit":39.33,"multi":3.04,"saleDate":"30/07/2025","receiveDate":"20/08/2025","createdAt":"2025-07-30T00:00:00.000Z"},{"id":"s0302","productId":"201","buyPrice":20.44,"sellPrice":50.63,"profit":30.19,"multi":2.48,"saleDate":"29/07/2025","receiveDate":"20/08/2025","createdAt":"2025-07-29T00:00:00.000Z"},{"id":"s0303","productId":"140","buyPrice":18.755,"sellPrice":50.63,"profit":31.88,"multi":2.7,"saleDate":"01/08/2025","receiveDate":"20/08/2025","createdAt":"2025-08-01T00:00:00.000Z"},{"id":"s0304","productId":"88","buyPrice":13.88,"sellPrice":42.0,"profit":28.12,"multi":3.03,"saleDate":"01/08/2025","receiveDate":"24/08/2025","createdAt":"2025-08-01T00:00:00.000Z"},{"id":"s0305","productId":"120","buyPrice":19.49,"sellPrice":55.63,"profit":36.14,"multi":2.85,"saleDate":"31/07/2025","receiveDate":"20/08/2025","createdAt":"2025-07-31T00:00:00.000Z"},{"id":"s0306","productId":"233","buyPrice":19.73,"sellPrice":50.63,"profit":30.9,"multi":2.57,"saleDate":"29/07/2025","receiveDate":"20/08/2025","createdAt":"2025-07-29T00:00:00.000Z"},{"id":"s0307","productId":"130","buyPrice":25.92,"sellPrice":48.54,"profit":22.62,"multi":1.87,"saleDate":"01/08/2025","receiveDate":"20/08/2025","createdAt":"2025-08-01T00:00:00.000Z"},{"id":"s0308","productId":"202","buyPrice":20.34,"sellPrice":58.9,"profit":38.56,"multi":2.9,"saleDate":"30/07/2025","receiveDate":"20/08/2025","createdAt":"2025-07-30T00:00:00.000Z"},{"id":"s0309","productId":"252","buyPrice":20.8,"sellPrice":107.55,"profit":86.75,"multi":5.17,"saleDate":"04/08/2025","receiveDate":"21/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0310","productId":"37","buyPrice":19.3,"sellPrice":49.0,"profit":29.7,"multi":2.54,"saleDate":"02/08/2025","receiveDate":"21/08/2025","createdAt":"2025-08-02T00:00:00.000Z"},{"id":"s0311","productId":"91","buyPrice":19.54,"sellPrice":50.18,"profit":30.64,"multi":2.57,"saleDate":"25/07/2025","receiveDate":"21/08/2025","createdAt":"2025-07-25T00:00:00.000Z"},{"id":"s0312","productId":"207 et 276","buyPrice":25.96,"sellPrice":120.63,"profit":94.67,"multi":4.65,"saleDate":"04/08/2025","receiveDate":"21/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0313","productId":"231","buyPrice":17.49,"sellPrice":49.63,"profit":32.14,"multi":2.84,"saleDate":"29/07/2025","receiveDate":"21/08/2025","createdAt":"2025-07-29T00:00:00.000Z"},{"id":"s0314","productId":"253","buyPrice":24.89,"sellPrice":80.63,"profit":55.74,"multi":3.24,"saleDate":"04/08/2025","receiveDate":"21/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0315","productId":"239","buyPrice":24.89,"sellPrice":85.54,"profit":60.65,"multi":3.44,"saleDate":"04/08/2025","receiveDate":"21/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0316","productId":"181","buyPrice":28.53,"sellPrice":60.63,"profit":32.1,"multi":2.13,"saleDate":"01/08/2025","receiveDate":"22/08/2025","createdAt":"2025-08-01T00:00:00.000Z"},{"id":"s0317","productId":"144","buyPrice":13.88,"sellPrice":22.54,"profit":8.66,"multi":1.62,"saleDate":"21/07/2025","receiveDate":"22/08/2025","createdAt":"2025-07-21T00:00:00.000Z"},{"id":"s0318","productId":"103","buyPrice":19.3,"sellPrice":60.63,"profit":41.33,"multi":3.14,"saleDate":"03/08/2025","receiveDate":"22/08/2025","createdAt":"2025-08-03T00:00:00.000Z"},{"id":"s0319","productId":"213","buyPrice":21.04,"sellPrice":43.6,"profit":22.56,"multi":2.07,"saleDate":"05/08/2025","receiveDate":"22/08/2025","createdAt":"2025-08-05T00:00:00.000Z"},{"id":"s0320","productId":"280","buyPrice":1.0,"sellPrice":36.6,"profit":35.6,"multi":36.6,"saleDate":"04/08/2025","receiveDate":"22/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0321","productId":"250","buyPrice":25.49,"sellPrice":49.63,"profit":24.14,"multi":1.95,"saleDate":"04/08/2025","receiveDate":"22/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0322","productId":"222","buyPrice":14.48,"sellPrice":39.55,"profit":25.07,"multi":2.73,"saleDate":"01/08/2025","receiveDate":"22/08/2025","createdAt":"2025-08-01T00:00:00.000Z"},{"id":"s0323","productId":"219","buyPrice":26.89,"sellPrice":72.63,"profit":45.74,"multi":2.7,"saleDate":"05/08/2025","receiveDate":"22/08/2025","createdAt":"2025-08-05T00:00:00.000Z"},{"id":"s0324","productId":"282","buyPrice":24.69,"sellPrice":52.63,"profit":27.94,"multi":2.13,"saleDate":"04/08/2025","receiveDate":"22/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0325","productId":"224","buyPrice":25.81,"sellPrice":49.55,"profit":23.74,"multi":1.92,"saleDate":"04/08/2025","receiveDate":"22/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0326","productId":"190","buyPrice":20.24,"sellPrice":50.63,"profit":30.39,"multi":2.5,"saleDate":"06/08/2025","receiveDate":"25/08/2025","createdAt":"2025-08-06T00:00:00.000Z"},{"id":"s0327","productId":"295","buyPrice":30.4,"sellPrice":47.63,"profit":17.23,"multi":1.57,"saleDate":"05/08/2025","receiveDate":"25/08/2025","createdAt":"2025-08-05T00:00:00.000Z"},{"id":"s0328","productId":"162","buyPrice":25.49,"sellPrice":55.63,"profit":30.14,"multi":2.18,"saleDate":"06/08/2025","receiveDate":"25/08/2025","createdAt":"2025-08-06T00:00:00.000Z"},{"id":"s0329","productId":"254","buyPrice":24.72,"sellPrice":57.13,"profit":32.41,"multi":2.31,"saleDate":"04/08/2025","receiveDate":"25/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0330","productId":"273","buyPrice":19.06,"sellPrice":55.63,"profit":36.57,"multi":2.92,"saleDate":"05/08/2025","receiveDate":"25/08/2025","createdAt":"2025-08-05T00:00:00.000Z"},{"id":"s0331","productId":"283","buyPrice":14.92,"sellPrice":37.55,"profit":22.63,"multi":2.52,"saleDate":"04/08/2025","receiveDate":"25/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0332","productId":"146","buyPrice":23.5,"sellPrice":46.53,"profit":23.03,"multi":1.98,"saleDate":"04/08/2025","receiveDate":"25/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0333","productId":"101","buyPrice":15.13,"sellPrice":32.55,"profit":17.42,"multi":2.15,"saleDate":"06/08/2025","receiveDate":"25/08/2025","createdAt":"2025-08-06T00:00:00.000Z"},{"id":"s0334","productId":"42","buyPrice":17.805,"sellPrice":49.55,"profit":31.74,"multi":2.78,"saleDate":"06/08/0225","receiveDate":"25/08/2025","createdAt":"0225-08-06T00:00:00.000Z"},{"id":"s0335","productId":"270","buyPrice":14.09,"sellPrice":69.55,"profit":55.46,"multi":4.94,"saleDate":"05/08/2025","receiveDate":"25/08/2025","createdAt":"2025-08-05T00:00:00.000Z"},{"id":"s0336","productId":"196","buyPrice":27.67,"sellPrice":55.63,"profit":27.96,"multi":2.01,"saleDate":"07/08/2025","receiveDate":"25/08/2025","createdAt":"2025-08-07T00:00:00.000Z"},{"id":"s0337","productId":"265","buyPrice":14.19,"sellPrice":47.55,"profit":33.36,"multi":3.35,"saleDate":"07/08/2025","receiveDate":"26/08/2025","createdAt":"2025-08-07T00:00:00.000Z"},{"id":"s0338","productId":"44","buyPrice":35.11,"sellPrice":55.55,"profit":20.44,"multi":1.58,"saleDate":"05/08/2025","receiveDate":"26/08/2025","createdAt":"2025-08-05T00:00:00.000Z"},{"id":"s0339","productId":"205","buyPrice":19.76,"sellPrice":48.54,"profit":28.78,"multi":2.46,"saleDate":"06/08/2025","receiveDate":"26/08/2025","createdAt":"2025-08-06T00:00:00.000Z"},{"id":"s0340","productId":"168","buyPrice":25.49,"sellPrice":50.71,"profit":25.22,"multi":1.99,"saleDate":"04/08/2025","receiveDate":"26/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0341","productId":"166","buyPrice":15.59,"sellPrice":55.55,"profit":39.96,"multi":3.56,"saleDate":"07/08/2025","receiveDate":"26/08/2025","createdAt":"2025-08-07T00:00:00.000Z"},{"id":"s0342","productId":"306","buyPrice":24.895,"sellPrice":52.55,"profit":27.65,"multi":2.11,"saleDate":"08/08/2025","receiveDate":"27/08/2025","createdAt":"2025-08-08T00:00:00.000Z"},{"id":"s0343","productId":"116","buyPrice":20.24,"sellPrice":45.53,"profit":25.29,"multi":2.25,"saleDate":"05/08/2025","receiveDate":"27/08/2025","createdAt":"2025-08-05T00:00:00.000Z"},{"id":"s0344","productId":"244","buyPrice":21.42,"sellPrice":47.55,"profit":26.13,"multi":2.22,"saleDate":"04/08/2025","receiveDate":"27/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0345","productId":"295","buyPrice":30.4,"sellPrice":67.55,"profit":37.15,"multi":2.22,"saleDate":"10/08/2025","receiveDate":"27/08/2025","createdAt":"2025-08-10T00:00:00.000Z"},{"id":"s0346","productId":"260","buyPrice":22.18,"sellPrice":45.8,"profit":23.62,"multi":2.06,"saleDate":"06/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-06T00:00:00.000Z"},{"id":"s0347","productId":"299","buyPrice":22.61,"sellPrice":53.81,"profit":31.2,"multi":2.38,"saleDate":"07/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-07T00:00:00.000Z"},{"id":"s0348","productId":"74","buyPrice":27.42,"sellPrice":55.55,"profit":28.13,"multi":2.03,"saleDate":"11/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-11T00:00:00.000Z"},{"id":"s0349","productId":"107","buyPrice":12.01,"sellPrice":45.63,"profit":33.62,"multi":3.8,"saleDate":"10/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-10T00:00:00.000Z"},{"id":"s0350","productId":"153","buyPrice":15.39,"sellPrice":25.0,"profit":9.61,"multi":1.62,"saleDate":"05/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-05T00:00:00.000Z"},{"id":"s0351","productId":"257","buyPrice":19.24,"sellPrice":49.55,"profit":30.31,"multi":2.58,"saleDate":"11/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-11T00:00:00.000Z"},{"id":"s0352","productId":"272","buyPrice":21.57,"sellPrice":69.54,"profit":47.97,"multi":3.22,"saleDate":"08/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-08T00:00:00.000Z"},{"id":"s0353","productId":"258","buyPrice":8.64,"sellPrice":28.63,"profit":19.99,"multi":3.31,"saleDate":"10/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-10T00:00:00.000Z"},{"id":"s0354","productId":"97","buyPrice":25.81,"sellPrice":56.63,"profit":30.82,"multi":2.19,"saleDate":"11/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-11T00:00:00.000Z"},{"id":"s0355","productId":"62","buyPrice":14.09,"sellPrice":58.54,"profit":44.45,"multi":4.15,"saleDate":"09/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-09T00:00:00.000Z"},{"id":"s0356","productId":"305","buyPrice":25.31,"sellPrice":65.74,"profit":40.43,"multi":2.6,"saleDate":"09/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-09T00:00:00.000Z"},{"id":"s0357","productId":"204","buyPrice":20.8,"sellPrice":45.55,"profit":24.75,"multi":2.19,"saleDate":"05/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-05T00:00:00.000Z"},{"id":"s0358","productId":"105","buyPrice":26.09,"sellPrice":57.55,"profit":31.46,"multi":2.21,"saleDate":"09/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-09T00:00:00.000Z"},{"id":"s0359","productId":"108","buyPrice":17.69,"sellPrice":43.63,"profit":25.94,"multi":2.47,"saleDate":"11/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-11T00:00:00.000Z"},{"id":"s0360","productId":"229","buyPrice":20.8,"sellPrice":65.8,"profit":45.0,"multi":3.16,"saleDate":"04/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0361","productId":"Timberland 287","buyPrice":14.19,"sellPrice":82.83,"profit":68.64,"multi":5.84,"saleDate":"06/08/2025","receiveDate":"28/08/2025","createdAt":"2025-08-06T00:00:00.000Z"},{"id":"s0362","productId":"302","buyPrice":19.54,"sellPrice":55.53,"profit":35.99,"multi":2.84,"saleDate":"10/08/2025","receiveDate":"29/09/2025","createdAt":"2025-08-10T00:00:00.000Z"},{"id":"s0363","productId":"303","buyPrice":5.95,"sellPrice":44.43,"profit":38.48,"multi":7.47,"saleDate":"12/08/2025","receiveDate":"01/09/2025","createdAt":"2025-08-12T00:00:00.000Z"},{"id":"s0364","productId":"96","buyPrice":23.91,"sellPrice":43.55,"profit":19.64,"multi":1.82,"saleDate":"08/08/2025","receiveDate":"01/09/2025","createdAt":"2025-08-08T00:00:00.000Z"},{"id":"s0365","productId":"246","buyPrice":23.62,"sellPrice":56.54,"profit":32.92,"multi":2.39,"saleDate":"04/08/2025","receiveDate":"01/09/2025","createdAt":"2025-08-04T00:00:00.000Z"},{"id":"s0366","productId":"151","buyPrice":14.09,"sellPrice":57.0,"profit":42.91,"multi":4.05,"saleDate":"12/08/2025","receiveDate":"01/09/2025","createdAt":"2025-08-12T00:00:00.000Z"},{"id":"s0367","productId":"184","buyPrice":28.53,"sellPrice":85.9,"profit":57.37,"multi":3.01,"saleDate":"10/08/2025","receiveDate":"01/09/2025","createdAt":"2025-08-10T00:00:00.000Z"},{"id":"s0368","productId":"197","buyPrice":26.14,"sellPrice":63.44,"profit":37.3,"multi":2.43,"saleDate":"09/08/2025","receiveDate":"01/09/2025","createdAt":"2025-08-09T00:00:00.000Z"},{"id":"s0369","productId":"30","buyPrice":12.2,"sellPrice":50.63,"profit":38.43,"multi":4.15,"saleDate":"13/08/2025","receiveDate":"01/09/2025","createdAt":"2025-08-13T00:00:00.000Z"},{"id":"s0370","productId":"126","buyPrice":18.755,"sellPrice":47.0,"profit":28.25,"multi":2.51,"saleDate":"13/08/2025","receiveDate":"02/09/2025","createdAt":"2025-08-13T00:00:00.000Z"},{"id":"s0371","productId":"95 a moi","buyPrice":20.0,"sellPrice":89.0,"profit":69.0,"multi":4.45,"saleDate":"12/08/2025","receiveDate":"02/09/2025","createdAt":"2025-08-12T00:00:00.000Z"},{"id":"s0372","productId":"296","buyPrice":14.89,"sellPrice":58.63,"profit":43.74,"multi":3.94,"saleDate":"13/08/2025","receiveDate":"02/09/2025","createdAt":"2025-08-13T00:00:00.000Z"},{"id":"s0373","productId":"259","buyPrice":20.59,"sellPrice":50.63,"profit":30.04,"multi":2.46,"saleDate":"17/08/2025","receiveDate":"03/09/2025","createdAt":"2025-08-17T00:00:00.000Z"},{"id":"s0374","productId":"328","buyPrice":26.49,"sellPrice":79.0,"profit":52.51,"multi":2.98,"saleDate":"14/08/2025","receiveDate":"03/09/2025","createdAt":"2025-08-14T00:00:00.000Z"},{"id":"s0375","productId":"211","buyPrice":13.44,"sellPrice":42.55,"profit":29.11,"multi":3.17,"saleDate":"17/08/2025","receiveDate":"03/09/2025","createdAt":"2025-08-17T00:00:00.000Z"},{"id":"s0376","productId":"322","buyPrice":15.55,"sellPrice":56.55,"profit":41.0,"multi":3.64,"saleDate":"14/08/2025","receiveDate":"03/09/2025","createdAt":"2025-08-14T00:00:00.000Z"},{"id":"s0377","productId":"75","buyPrice":16.36,"sellPrice":28.63,"profit":12.27,"multi":1.75,"saleDate":"17/08/2025","receiveDate":"03/09/2025","createdAt":"2025-08-17T00:00:00.000Z"},{"id":"s0378","productId":"251","buyPrice":24.895,"sellPrice":65.0,"profit":40.11,"multi":2.61,"saleDate":"18/08/2025","receiveDate":"04/09/2025","createdAt":"2025-08-18T00:00:00.000Z"},{"id":"s0379","productId":"326","buyPrice":16.69,"sellPrice":40.55,"profit":23.86,"multi":2.43,"saleDate":"17/08/2025","receiveDate":"04/09/2025","createdAt":"2025-08-17T00:00:00.000Z"},{"id":"s0380","productId":"216 et 304","buyPrice":36.74,"sellPrice":99.76,"profit":63.02,"multi":2.72,"saleDate":"12/08/2025","receiveDate":"04/09/2025","createdAt":"2025-08-12T00:00:00.000Z"},{"id":"s0381","productId":"194","buyPrice":14.19,"sellPrice":45.63,"profit":31.44,"multi":3.22,"saleDate":"17/08/2025","receiveDate":"04/09/2025","createdAt":"2025-08-17T00:00:00.000Z"},{"id":"s0382","productId":"14","buyPrice":25.89,"sellPrice":47.55,"profit":21.66,"multi":1.84,"saleDate":"17/08/2025","receiveDate":"04/09/2025","createdAt":"2025-08-17T00:00:00.000Z"},{"id":"s0383","productId":"268","buyPrice":20.84,"sellPrice":105.55,"profit":84.71,"multi":5.06,"saleDate":"15/08/2025","receiveDate":"04/09/2025","createdAt":"2025-08-15T00:00:00.000Z"},{"id":"s0384","productId":"261","buyPrice":14.19,"sellPrice":54.9,"profit":40.71,"multi":3.87,"saleDate":"13/08/2025","receiveDate":"04/09/2025","createdAt":"2025-08-13T00:00:00.000Z"},{"id":"s0385","productId":"152","buyPrice":8.1,"sellPrice":29.71,"profit":21.61,"multi":3.67,"saleDate":"12/08/2025","receiveDate":"04/09/2025","createdAt":"2025-08-12T00:00:00.000Z"},{"id":"s0386","productId":"241","buyPrice":24.895,"sellPrice":68.55,"profit":43.66,"multi":2.75,"saleDate":"18/08/2025","receiveDate":"04/09/2025","createdAt":"2025-08-18T00:00:00.000Z"},{"id":"s0387","productId":"52","buyPrice":13.11,"sellPrice":46.63,"profit":33.52,"multi":3.56,"saleDate":"14/08/2025","receiveDate":"05/09/2025","createdAt":"2025-08-14T00:00:00.000Z"},{"id":"s0388","productId":"314","buyPrice":17.94,"sellPrice":52.85,"profit":34.91,"multi":2.95,"saleDate":"10/08/2025","receiveDate":"05/09/2025","createdAt":"2025-08-10T00:00:00.000Z"},{"id":"s0389","productId":"145","buyPrice":19.49,"sellPrice":34.55,"profit":15.06,"multi":1.77,"saleDate":"17/08/2025","receiveDate":"05/09/2025","createdAt":"2025-08-17T00:00:00.000Z"},{"id":"s0390","productId":"308","buyPrice":17.47,"sellPrice":44.63,"profit":27.16,"multi":2.55,"saleDate":"15/09/2025","receiveDate":"05/09/2025","createdAt":"2025-09-15T00:00:00.000Z"},{"id":"s0391","productId":"127 et 321","buyPrice":35.045,"sellPrice":96.63,"profit":61.58,"multi":2.76,"saleDate":"13/08/2025","receiveDate":"05/09/2025","createdAt":"2025-08-13T00:00:00.000Z"},{"id":"s0392","productId":"338","buyPrice":26.09,"sellPrice":50.0,"profit":23.91,"multi":1.92,"saleDate":"17/08/2025","receiveDate":"05/09/2025","createdAt":"2025-08-17T00:00:00.000Z"},{"id":"s0393","productId":"26","buyPrice":20.1,"sellPrice":50.05,"profit":29.95,"multi":2.49,"saleDate":"13/08/2025","receiveDate":"05/09/2025","createdAt":"2025-08-13T00:00:00.000Z"},{"id":"s0394","productId":"133","buyPrice":14.28,"sellPrice":16.63,"profit":2.35,"multi":1.16,"saleDate":"17/08/2025","receiveDate":"05/09/2025","createdAt":"2025-08-17T00:00:00.000Z"},{"id":"s0395","productId":"Samba 49","buyPrice":11.0,"sellPrice":45.8,"profit":34.8,"multi":4.16,"saleDate":"16/08/2025","receiveDate":"05/09/2025","createdAt":"2025-08-16T00:00:00.000Z"},{"id":"s0396","productId":"315","buyPrice":14.19,"sellPrice":43.71,"profit":29.52,"multi":3.08,"saleDate":"17/08/2025","receiveDate":"05/09/2025","createdAt":"2025-08-17T00:00:00.000Z"},{"id":"s0397","productId":"164","buyPrice":19.54,"sellPrice":45.55,"profit":26.01,"multi":2.33,"saleDate":"17/08/2025","receiveDate":"05/09/2025","createdAt":"2025-08-17T00:00:00.000Z"},{"id":"s0398","productId":"83","buyPrice":15.79,"sellPrice":45.2,"profit":29.41,"multi":2.86,"saleDate":"14/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-14T00:00:00.000Z"},{"id":"s0399","productId":"323","buyPrice":1.0,"sellPrice":15.54,"profit":14.54,"multi":15.54,"saleDate":"12/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-12T00:00:00.000Z"},{"id":"s0400","productId":"82","buyPrice":21.035,"sellPrice":35.63,"profit":14.6,"multi":1.69,"saleDate":"20/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0401","productId":"301","buyPrice":24.895,"sellPrice":49.55,"profit":24.65,"multi":1.99,"saleDate":"15/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-15T00:00:00.000Z"},{"id":"s0402","productId":"209","buyPrice":22.84,"sellPrice":41.13,"profit":18.29,"multi":1.8,"saleDate":"17/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-17T00:00:00.000Z"},{"id":"s0403","productId":"174","buyPrice":19.59,"sellPrice":57.55,"profit":37.96,"multi":2.94,"saleDate":"20/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0404","productId":"154","buyPrice":21.84,"sellPrice":38.63,"profit":16.79,"multi":1.77,"saleDate":"20/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0405","productId":"8","buyPrice":24.79,"sellPrice":50.54,"profit":25.75,"multi":2.04,"saleDate":"09/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-09T00:00:00.000Z"},{"id":"s0406","productId":"73","buyPrice":24.79,"sellPrice":52.85,"profit":28.06,"multi":2.13,"saleDate":"19/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-19T00:00:00.000Z"},{"id":"s0407","productId":"364","buyPrice":19.33,"sellPrice":52.63,"profit":33.3,"multi":2.72,"saleDate":"20/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0408","productId":"72","buyPrice":20.0,"sellPrice":35.63,"profit":15.63,"multi":1.78,"saleDate":"20/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0409","productId":"61","buyPrice":14.79,"sellPrice":28.74,"profit":13.95,"multi":1.94,"saleDate":"11/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-11T00:00:00.000Z"},{"id":"s0410","productId":"317","buyPrice":23.21,"sellPrice":48.33,"profit":25.12,"multi":2.08,"saleDate":"19/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-19T00:00:00.000Z"},{"id":"s0411","productId":"186","buyPrice":38.945,"sellPrice":78.63,"profit":39.68,"multi":2.02,"saleDate":"19/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-19T00:00:00.000Z"},{"id":"s0412","productId":"192","buyPrice":14.99,"sellPrice":42.33,"profit":27.34,"multi":2.82,"saleDate":"18/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-18T00:00:00.000Z"},{"id":"s0413","productId":"129","buyPrice":18.755,"sellPrice":56.55,"profit":37.8,"multi":3.02,"saleDate":"12/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-12T00:00:00.000Z"},{"id":"s0414","productId":"335","buyPrice":11.53,"sellPrice":40.53,"profit":29.0,"multi":3.52,"saleDate":"18/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-18T00:00:00.000Z"},{"id":"s0415","productId":"332","buyPrice":19.54,"sellPrice":45.71,"profit":26.17,"multi":2.34,"saleDate":"14/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-14T00:00:00.000Z"},{"id":"s0416","productId":"324","buyPrice":9.04,"sellPrice":32.93,"profit":23.89,"multi":3.64,"saleDate":"20/08/2025","receiveDate":"08/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0417","productId":"134","buyPrice":18.755,"sellPrice":45.55,"profit":26.79,"multi":2.43,"saleDate":"19/08/2025","receiveDate":"09/09/2025","createdAt":"2025-08-19T00:00:00.000Z"},{"id":"s0418","productId":"203","buyPrice":19.44,"sellPrice":40.0,"profit":20.56,"multi":2.06,"saleDate":"20/08/2025","receiveDate":"09/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0419","productId":"22","buyPrice":19.3,"sellPrice":47.53,"profit":28.23,"multi":2.46,"saleDate":"18/08/2025","receiveDate":"09/09/2025","createdAt":"2025-08-18T00:00:00.000Z"},{"id":"s0420","productId":"354","buyPrice":9.58,"sellPrice":35.54,"profit":25.96,"multi":3.71,"saleDate":"19/08/2025","receiveDate":"09/09/2025","createdAt":"2025-08-19T00:00:00.000Z"},{"id":"s0421","productId":"365","buyPrice":10.27,"sellPrice":34.75,"profit":24.48,"multi":3.38,"saleDate":"21/08/2025","receiveDate":"09/09/2025","createdAt":"2025-08-21T00:00:00.000Z"},{"id":"s0422","productId":"226","buyPrice":16.86,"sellPrice":64.55,"profit":47.69,"multi":3.83,"saleDate":"20/08/2025","receiveDate":"09/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0423","productId":"170","buyPrice":21.84,"sellPrice":40.55,"profit":18.71,"multi":1.86,"saleDate":"18/08/2025","receiveDate":"09/09/2025","createdAt":"2025-08-18T00:00:00.000Z"},{"id":"s0424","productId":"368","buyPrice":15.19,"sellPrice":50.63,"profit":35.44,"multi":3.33,"saleDate":"21/08/2025","receiveDate":"09/09/2025","createdAt":"2025-08-21T00:00:00.000Z"},{"id":"s0425","productId":"262","buyPrice":14.29,"sellPrice":42.71,"profit":28.42,"multi":2.99,"saleDate":"20/08/2025","receiveDate":"10/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0426","productId":"242","buyPrice":20.24,"sellPrice":40.55,"profit":20.31,"multi":2.0,"saleDate":"19/08/2025","receiveDate":"10/09/2025","createdAt":"2025-08-19T00:00:00.000Z"},{"id":"s0427","productId":"377","buyPrice":25.81,"sellPrice":58.63,"profit":32.82,"multi":2.27,"saleDate":"23/08/2025","receiveDate":"10/09/2025","createdAt":"2025-08-23T00:00:00.000Z"},{"id":"s0428","productId":"313","buyPrice":30.81,"sellPrice":63.71,"profit":32.9,"multi":2.07,"saleDate":"21/08/2025","receiveDate":"10/09/2025","createdAt":"2025-08-21T00:00:00.000Z"},{"id":"s0429","productId":"349","buyPrice":13.89,"sellPrice":42.71,"profit":28.82,"multi":3.07,"saleDate":"19/08/2025","receiveDate":"10/09/2025","createdAt":"2025-08-19T00:00:00.000Z"},{"id":"s0430","productId":"309 et 379","buyPrice":29.28,"sellPrice":115.63,"profit":86.35,"multi":3.95,"saleDate":"23/08/2025","receiveDate":"10/09/2025","createdAt":"2025-08-23T00:00:00.000Z"},{"id":"s0431","productId":"360","buyPrice":18.11,"sellPrice":60.63,"profit":42.52,"multi":3.35,"saleDate":"20/08/2025","receiveDate":"10/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0432","productId":"374","buyPrice":12.89,"sellPrice":39.55,"profit":26.66,"multi":3.07,"saleDate":"22/08/2025","receiveDate":"11/09/2025","createdAt":"2025-08-22T00:00:00.000Z"},{"id":"s0433","productId":"206","buyPrice":24.98,"sellPrice":48.74,"profit":23.76,"multi":1.95,"saleDate":"19/08/2025","receiveDate":"11/09/2025","createdAt":"2025-08-19T00:00:00.000Z"},{"id":"s0434","productId":"274","buyPrice":23.72,"sellPrice":56.43,"profit":32.71,"multi":2.38,"saleDate":"21/08/2025","receiveDate":"11/09/2025","createdAt":"2025-08-21T00:00:00.000Z"},{"id":"s0435","productId":"372","buyPrice":14.79,"sellPrice":54.7,"profit":39.91,"multi":3.7,"saleDate":"22/08/2025","receiveDate":"11/09/2025","createdAt":"2025-08-22T00:00:00.000Z"},{"id":"s0436","productId":"86","buyPrice":31.01,"sellPrice":65.54,"profit":34.53,"multi":2.11,"saleDate":"23/08/2025","receiveDate":"11/09/2025","createdAt":"2025-08-23T00:00:00.000Z"},{"id":"s0437","productId":"112","buyPrice":14.48,"sellPrice":30.71,"profit":16.23,"multi":2.12,"saleDate":"21/08/2025","receiveDate":"11/09/2025","createdAt":"2025-08-21T00:00:00.000Z"},{"id":"s0438","productId":"58","buyPrice":29.71,"sellPrice":33.71,"profit":4.0,"multi":1.13,"saleDate":"23/08/2025","receiveDate":"11/09/2025","createdAt":"2025-08-23T00:00:00.000Z"},{"id":"s0439","productId":"376","buyPrice":8.69,"sellPrice":33.71,"profit":25.02,"multi":3.88,"saleDate":"22/08/2025","receiveDate":"11/09/2025","createdAt":"2025-08-22T00:00:00.000Z"},{"id":"s0440","productId":"327","buyPrice":20.24,"sellPrice":44.05,"profit":23.81,"multi":2.18,"saleDate":"21/08/2025","receiveDate":"11/09/2025","createdAt":"2025-08-21T00:00:00.000Z"},{"id":"s0441","productId":"375","buyPrice":14.09,"sellPrice":56.03,"profit":41.94,"multi":3.98,"saleDate":"22/08/2025","receiveDate":"11/09/2025","createdAt":"2025-08-22T00:00:00.000Z"},{"id":"s0442","productId":"32","buyPrice":14.29,"sellPrice":15.71,"profit":1.42,"multi":1.1,"saleDate":"22/08/2025","receiveDate":"11/09/2025","createdAt":"2025-08-22T00:00:00.000Z"},{"id":"s0443","productId":"29","buyPrice":7.49,"sellPrice":30.83,"profit":23.34,"multi":4.12,"saleDate":"15/08/2025","receiveDate":"11/09/2025","createdAt":"2025-08-15T00:00:00.000Z"},{"id":"s0444","productId":"320","buyPrice":17.94,"sellPrice":45.87,"profit":27.93,"multi":2.56,"saleDate":"24/08/2025","receiveDate":"11/09/2025","createdAt":"2025-08-24T00:00:00.000Z"},{"id":"s0445","productId":"225","buyPrice":24.79,"sellPrice":50.71,"profit":25.92,"multi":2.05,"saleDate":"21/08/2025","receiveDate":"12/09/2025","createdAt":"2025-08-21T00:00:00.000Z"},{"id":"s0446","productId":"212","buyPrice":17.98,"sellPrice":39.63,"profit":21.65,"multi":2.2,"saleDate":"23/08/2025","receiveDate":"12/09/2025","createdAt":"2025-08-23T00:00:00.000Z"},{"id":"s0447","productId":"156","buyPrice":24.76,"sellPrice":49.54,"profit":24.78,"multi":2.0,"saleDate":"20/08/2025","receiveDate":"12/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0448","productId":"336","buyPrice":20.64,"sellPrice":44.2,"profit":23.56,"multi":2.14,"saleDate":"20/08/2025","receiveDate":"12/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0449","productId":"57","buyPrice":37.32,"sellPrice":44.55,"profit":7.23,"multi":1.19,"saleDate":"25/08/2025","receiveDate":"12/09/2025","createdAt":"2025-08-25T00:00:00.000Z"},{"id":"s0450","productId":"300 et 316","buyPrice":40.58,"sellPrice":70.63,"profit":30.05,"multi":1.74,"saleDate":"26/08/2025","receiveDate":"15/09/2025","createdAt":"2025-08-26T00:00:00.000Z"},{"id":"s0451","productId":"388","buyPrice":14.39,"sellPrice":37.63,"profit":23.24,"multi":2.62,"saleDate":"25/08/2025","receiveDate":"15/09/2025","createdAt":"2025-08-25T00:00:00.000Z"},{"id":"s0452","productId":"345","buyPrice":24.51,"sellPrice":46.63,"profit":22.12,"multi":1.9,"saleDate":"26/08/2025","receiveDate":"15/09/2025","createdAt":"2025-08-26T00:00:00.000Z"},{"id":"s0453","productId":"279","buyPrice":9.88,"sellPrice":40.55,"profit":30.67,"multi":4.1,"saleDate":"24/08/2025","receiveDate":"15/09/2025","createdAt":"2025-08-24T00:00:00.000Z"},{"id":"s0454","productId":"398","buyPrice":36.54,"sellPrice":80.55,"profit":44.01,"multi":2.2,"saleDate":"26/08/2025","receiveDate":"15/09/2025","createdAt":"2025-08-26T00:00:00.000Z"},{"id":"s0455","productId":"27","buyPrice":36.65,"sellPrice":59.63,"profit":22.98,"multi":1.63,"saleDate":"28/08/2025","receiveDate":"15/09/2025","createdAt":"2025-08-28T00:00:00.000Z"},{"id":"s0456","productId":"341","buyPrice":19.3,"sellPrice":60.63,"profit":41.33,"multi":3.14,"saleDate":"20/08/2025","receiveDate":"15/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0457","productId":"167 et 346","buyPrice":29.28,"sellPrice":79.73,"profit":50.45,"multi":2.72,"saleDate":"28/08/2025","receiveDate":"15/09/2025","createdAt":"2025-08-28T00:00:00.000Z"},{"id":"s0458","productId":"311","buyPrice":14.28,"sellPrice":42.63,"profit":28.35,"multi":2.99,"saleDate":"25/08/2025","receiveDate":"15/09/2025","createdAt":"2025-08-25T00:00:00.000Z"},{"id":"s0459","productId":"402","buyPrice":20.94,"sellPrice":41.95,"profit":21.01,"multi":2.0,"saleDate":"29/08/2025","receiveDate":"15/09/2025","createdAt":"2025-08-29T00:00:00.000Z"},{"id":"s0460","productId":"214 1 er vente","buyPrice":19.34,"sellPrice":57.0,"profit":37.66,"multi":2.95,"saleDate":"18/08/2025","receiveDate":"16/09/2025","createdAt":"2025-08-18T00:00:00.000Z"},{"id":"s0461","productId":"403","buyPrice":18.14,"sellPrice":41.63,"profit":23.49,"multi":2.29,"saleDate":"28/08/2025","receiveDate":"16/09/2025","createdAt":"2025-08-28T00:00:00.000Z"},{"id":"s0462","productId":"150","buyPrice":18.755,"sellPrice":69.71,"profit":50.95,"multi":3.72,"saleDate":"16/08/2025","receiveDate":"18/09/2025","createdAt":"2025-08-16T00:00:00.000Z"},{"id":"s0463","productId":"106","buyPrice":15.96,"sellPrice":38.63,"profit":22.67,"multi":2.42,"saleDate":"29/08/2025","receiveDate":"16/09/2025","createdAt":"2025-08-29T00:00:00.000Z"},{"id":"s0464","productId":"387","buyPrice":24.51,"sellPrice":77.55,"profit":53.04,"multi":3.16,"saleDate":"30/08/2025","receiveDate":"16/09/2025","createdAt":"2025-08-30T00:00:00.000Z"},{"id":"s0465","productId":"16","buyPrice":8.1,"sellPrice":27.63,"profit":19.53,"multi":3.41,"saleDate":"29/06/2025","receiveDate":"16/09/2025","createdAt":"2025-06-29T00:00:00.000Z"},{"id":"s0466","productId":"161","buyPrice":20.64,"sellPrice":34.75,"profit":14.11,"multi":1.68,"saleDate":"29/08/2025","receiveDate":"16/09/2025","createdAt":"2025-08-29T00:00:00.000Z"},{"id":"s0467","productId":"36","buyPrice":19.3,"sellPrice":48.68,"profit":29.38,"multi":2.52,"saleDate":"20/08/2025","receiveDate":"16/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0468","productId":"417","buyPrice":28.72,"sellPrice":67.0,"profit":38.28,"multi":2.33,"saleDate":"30/08/2025","receiveDate":"17/09/2025","createdAt":"2025-08-30T00:00:00.000Z"},{"id":"s0469","productId":"348","buyPrice":15.99,"sellPrice":40.2,"profit":24.21,"multi":2.51,"saleDate":"20/08/2025","receiveDate":"17/09/2025","createdAt":"2025-08-20T00:00:00.000Z"},{"id":"s0470","productId":"394","buyPrice":12.06,"sellPrice":52.01,"profit":39.95,"multi":4.31,"saleDate":"27/09/2025","receiveDate":"17/09/2025","createdAt":"2025-09-27T00:00:00.000Z"},{"id":"s0471","productId":"121","buyPrice":12.2,"sellPrice":37.55,"profit":25.35,"multi":3.08,"saleDate":"29/08/2025","receiveDate":"17/09/2025","createdAt":"2025-08-29T00:00:00.000Z"},{"id":"s0472","productId":"399","buyPrice":26.09,"sellPrice":49.71,"profit":23.62,"multi":1.91,"saleDate":"28/08/2025","receiveDate":"17/09/2025","createdAt":"2025-08-28T00:00:00.000Z"},{"id":"s0473","productId":"292","buyPrice":16.39,"sellPrice":40.55,"profit":24.16,"multi":2.47,"saleDate":"27/08/2025","receiveDate":"17/09/2025","createdAt":"2025-08-27T00:00:00.000Z"},{"id":"s0474","productId":"293","buyPrice":24.76,"sellPrice":55.82,"profit":31.06,"multi":2.25,"saleDate":"28/08/2025","receiveDate":"17/09/2025","createdAt":"2025-08-28T00:00:00.000Z"},{"id":"s0475","productId":"10","buyPrice":24.51,"sellPrice":60.71,"profit":36.2,"multi":2.48,"saleDate":"27/08/2025","receiveDate":"17/09/2025","createdAt":"2025-08-27T00:00:00.000Z"},{"id":"s0476","productId":"110","buyPrice":26.35,"sellPrice":42.74,"profit":16.39,"multi":1.62,"saleDate":"29/08/2025","receiveDate":"17/09/2025","createdAt":"2025-08-29T00:00:00.000Z"},{"id":"s0477","productId":"414","buyPrice":14.08,"sellPrice":50.63,"profit":36.55,"multi":3.6,"saleDate":"30/08/2025","receiveDate":"18/09/2025","createdAt":"2025-08-30T00:00:00.000Z"},{"id":"s0478","productId":"397","buyPrice":12.71,"sellPrice":45.0,"profit":32.29,"multi":3.54,"saleDate":"31/08/2025","receiveDate":"18/09/2025","createdAt":"2025-08-31T00:00:00.000Z"},{"id":"s0479","productId":"124","buyPrice":25.92,"sellPrice":65.55,"profit":39.63,"multi":2.53,"saleDate":"25/08/2025","receiveDate":"18/09/2025","createdAt":"2025-08-25T00:00:00.000Z"},{"id":"s0480","productId":"115","buyPrice":23.32,"sellPrice":57.55,"profit":34.23,"multi":2.47,"saleDate":"30/08/2025","receiveDate":"18/09/2025","createdAt":"2025-08-30T00:00:00.000Z"},{"id":"s0481","productId":"420","buyPrice":23.72,"sellPrice":56.55,"profit":32.83,"multi":2.38,"saleDate":"30/08/2025","receiveDate":"18/09/2025","createdAt":"2025-08-30T00:00:00.000Z"},{"id":"s0482","productId":"356","buyPrice":29.31,"sellPrice":45.74,"profit":16.43,"multi":1.56,"saleDate":"28/08/2025","receiveDate":"19/09/2025","createdAt":"2025-08-28T00:00:00.000Z"},{"id":"s0483","productId":"425","buyPrice":13.59,"sellPrice":51.71,"profit":38.12,"multi":3.81,"saleDate":"01/09/2025","receiveDate":"19/09/2025","createdAt":"2025-09-01T00:00:00.000Z"},{"id":"s0484","productId":"109","buyPrice":22.21,"sellPrice":39.54,"profit":17.33,"multi":1.78,"saleDate":"31/08/2025","receiveDate":"19/09/2025","createdAt":"2025-08-31T00:00:00.000Z"},{"id":"s0485","productId":"53","buyPrice":13.11,"sellPrice":40.63,"profit":27.52,"multi":3.1,"saleDate":"30/08/2025","receiveDate":"19/09/2025","createdAt":"2025-08-30T00:00:00.000Z"},{"id":"s0486","productId":"46","buyPrice":22.42,"sellPrice":29.55,"profit":7.13,"multi":1.32,"saleDate":"01/09/2025","receiveDate":"19/09/2025","createdAt":"2025-09-01T00:00:00.000Z"},{"id":"s0487","productId":"228","buyPrice":22.59,"sellPrice":45.63,"profit":23.04,"multi":2.02,"saleDate":"28/08/2025","receiveDate":"19/09/2025","createdAt":"2025-08-28T00:00:00.000Z"},{"id":"s0488","productId":"410","buyPrice":20.56,"sellPrice":25.63,"profit":5.07,"multi":1.25,"saleDate":"31/08/2025","receiveDate":"19/09/2025","createdAt":"2025-08-31T00:00:00.000Z"},{"id":"s0489","productId":"221","buyPrice":20.34,"sellPrice":35.9,"profit":15.56,"multi":1.76,"saleDate":"10/08/2025","receiveDate":"22/09/2025","createdAt":"2025-08-10T00:00:00.000Z"},{"id":"s0490","productId":"238","buyPrice":15.59,"sellPrice":41.2,"profit":25.61,"multi":2.64,"saleDate":"30/08/2025","receiveDate":"22/09/2025","createdAt":"2025-08-30T00:00:00.000Z"},{"id":"s0491","productId":"235","buyPrice":24.7,"sellPrice":50.53,"profit":25.83,"multi":2.05,"saleDate":"29/08/2025","receiveDate":"22/09/2025","createdAt":"2025-08-29T00:00:00.000Z"},{"id":"s0492","productId":"429","buyPrice":11.2,"sellPrice":38.43,"profit":27.23,"multi":3.43,"saleDate":"02//09/2025","receiveDate":"22/09/2025","createdAt":"2025-01-01T00:00:00.000Z"},{"id":"s0493","productId":"173","buyPrice":19.73,"sellPrice":34.55,"profit":14.82,"multi":1.75,"saleDate":"04/09/2025","receiveDate":"22/09/2025","createdAt":"2025-09-04T00:00:00.000Z"},{"id":"s0494","productId":"312","buyPrice":19.49,"sellPrice":42.13,"profit":22.64,"multi":2.16,"saleDate":"29/08/2025","receiveDate":"22/09/2025","createdAt":"2025-08-29T00:00:00.000Z"},{"id":"s0495","productId":"318 et 278","buyPrice":34.69,"sellPrice":82.73,"profit":48.04,"multi":2.38,"saleDate":"02/09/2025","receiveDate":"22/09/2025","createdAt":"2025-09-02T00:00:00.000Z"},{"id":"s0496","productId":"291","buyPrice":23.72,"sellPrice":38.63,"profit":14.91,"multi":1.63,"saleDate":"03/09/2025","receiveDate":"22/09/2025","createdAt":"2025-09-03T00:00:00.000Z"},{"id":"s0497","productId":"382","buyPrice":14.29,"sellPrice":34.54,"profit":20.25,"multi":2.42,"saleDate":"02/09/2025","receiveDate":"22/09/2025","createdAt":"2025-09-02T00:00:00.000Z"},{"id":"s0498","productId":"391","buyPrice":16.36,"sellPrice":35.63,"profit":19.27,"multi":2.18,"saleDate":"02/09/2025","receiveDate":"22/09/2025","createdAt":"2025-09-02T00:00:00.000Z"},{"id":"s0499","productId":"66","buyPrice":1.0,"sellPrice":50.63,"profit":49.63,"multi":50.63,"saleDate":"01/09/2025","receiveDate":"22/09/2025","createdAt":"2025-09-01T00:00:00.000Z"},{"id":"s0500","productId":"424","buyPrice":11.28,"sellPrice":29.74,"profit":18.46,"multi":2.64,"saleDate":"02/09/2025","receiveDate":"23/09/2025","createdAt":"2025-09-02T00:00:00.000Z"},{"id":"s0501","productId":"404","buyPrice":16.44,"sellPrice":51.2,"profit":34.76,"multi":3.11,"saleDate":"29/08/2025","receiveDate":"23/09/2025","createdAt":"2025-08-29T00:00:00.000Z"},{"id":"s0502","productId":"289","buyPrice":26.85,"sellPrice":57.55,"profit":30.7,"multi":2.14,"saleDate":"04/09/2025","receiveDate":"23/09/2025","createdAt":"2025-09-04T00:00:00.000Z"},{"id":"s0503","productId":"385","buyPrice":24.7,"sellPrice":45.71,"profit":21.01,"multi":1.85,"saleDate":"04/09/2025","receiveDate":"24/09/2025","createdAt":"2025-09-04T00:00:00.000Z"},{"id":"s0504","productId":"187","buyPrice":35.48,"sellPrice":60.63,"profit":25.15,"multi":1.71,"saleDate":"06/09/2025","receiveDate":"24/09/2025","createdAt":"2025-09-06T00:00:00.000Z"},{"id":"s0505","productId":"433","buyPrice":17.805,"sellPrice":46.63,"profit":28.83,"multi":2.62,"saleDate":"04/09/2025","receiveDate":"24/09/2025","createdAt":"2025-09-04T00:00:00.000Z"},{"id":"s0506","productId":"128","buyPrice":8.67,"sellPrice":20.54,"profit":11.87,"multi":2.37,"saleDate":"05/09/2025","receiveDate":"24/09/2025","createdAt":"2025-09-05T00:00:00.000Z"},{"id":"s0507","productId":"430","buyPrice":19.54,"sellPrice":45.71,"profit":26.17,"multi":2.34,"saleDate":"04/09/2025","receiveDate":"24/09/2025","createdAt":"2025-09-04T00:00:00.000Z"},{"id":"s0508","productId":"294","buyPrice":26.85,"sellPrice":55.63,"profit":28.78,"multi":2.07,"saleDate":"04/09/2025","receiveDate":"24/09/2025","createdAt":"2025-09-04T00:00:00.000Z"},{"id":"s0509","productId":"411","buyPrice":15.39,"sellPrice":55.63,"profit":40.24,"multi":3.61,"saleDate":"05/09/2025","receiveDate":"25/09/2025","createdAt":"2025-09-05T00:00:00.000Z"},{"id":"s0510","productId":"297","buyPrice":22.42,"sellPrice":60.63,"profit":38.21,"multi":2.7,"saleDate":"04/09/2025","receiveDate":"25/09/2025","createdAt":"2025-09-04T00:00:00.000Z"},{"id":"s0511","productId":"447","buyPrice":17.69,"sellPrice":47.33,"profit":29.64,"multi":2.68,"saleDate":"08/09/2025","receiveDate":"25/09/2025","createdAt":"2025-09-08T00:00:00.000Z"},{"id":"s0512","productId":"381","buyPrice":26.09,"sellPrice":43.74,"profit":17.65,"multi":1.68,"saleDate":"02/09/2025","receiveDate":"26/09/2025","createdAt":"2025-09-02T00:00:00.000Z"},{"id":"s0513","productId":"357","buyPrice":29.31,"sellPrice":49.63,"profit":20.32,"multi":1.69,"saleDate":"06/09/2025","receiveDate":"26/09/2025","createdAt":"2025-09-06T00:00:00.000Z"},{"id":"s0514","productId":"347","buyPrice":19.54,"sellPrice":40.57,"profit":21.03,"multi":2.08,"saleDate":"06/09/2025","receiveDate":"26/09/2025","createdAt":"2025-09-06T00:00:00.000Z"},{"id":"s0515","productId":"342","buyPrice":20.74,"sellPrice":48.9,"profit":28.16,"multi":2.36,"saleDate":"06/09/2025","receiveDate":"26/09/2025","createdAt":"2025-09-06T00:00:00.000Z"},{"id":"s0516","productId":"218","buyPrice":10.18,"sellPrice":24.63,"profit":14.45,"multi":2.42,"saleDate":"05/09/2025","receiveDate":"26/09/2025","createdAt":"2025-09-05T00:00:00.000Z"},{"id":"s0517","productId":"267","buyPrice":1.0,"sellPrice":7.7,"profit":6.7,"multi":7.7,"saleDate":"08/09/2025","receiveDate":"29/09/2025","createdAt":"2025-09-08T00:00:00.000Z"},{"id":"s0518","productId":"439","buyPrice":25.81,"sellPrice":53.68,"profit":27.87,"multi":2.08,"saleDate":"06/09/2025","receiveDate":"29/09/2025","createdAt":"2025-09-06T00:00:00.000Z"},{"id":"s0519","productId":"373","buyPrice":20.64,"sellPrice":49.55,"profit":28.91,"multi":2.4,"saleDate":"30/08/2025","receiveDate":"29/09/2025","createdAt":"2025-08-30T00:00:00.000Z"},{"id":"s0520","productId":"395","buyPrice":12.6,"sellPrice":35.63,"profit":23.03,"multi":2.83,"saleDate":"07/09/2025","receiveDate":"29/09/2025","createdAt":"2025-09-07T00:00:00.000Z"},{"id":"s0521","productId":"285","buyPrice":15.58,"sellPrice":49.55,"profit":33.97,"multi":3.18,"saleDate":"10/08/2025","receiveDate":"27/09/2025","createdAt":"2025-08-10T00:00:00.000Z"},{"id":"s0522","productId":"64","buyPrice":15.01,"sellPrice":28.63,"profit":13.62,"multi":1.91,"saleDate":"10/09/2025","receiveDate":"29/09/2025","createdAt":"2025-09-10T00:00:00.000Z"},{"id":"s0523","productId":"100 et 1 et 440","buyPrice":42.54,"sellPrice":140.0,"profit":97.46,"multi":3.29,"saleDate":"09/09/2025","receiveDate":"30/09/2025","createdAt":"2025-09-09T00:00:00.000Z"},{"id":"s0524","productId":"343","buyPrice":11.79,"sellPrice":40.23,"profit":28.44,"multi":3.41,"saleDate":"12/09/2025","receiveDate":"30/09/2025","createdAt":"2025-09-12T00:00:00.000Z"},{"id":"s0525","productId":"456","buyPrice":18.79,"sellPrice":43.13,"profit":24.34,"multi":2.3,"saleDate":"10/09/2025","receiveDate":"01/10/2025","createdAt":"2025-09-10T00:00:00.000Z"},{"id":"s0526","productId":"185","buyPrice":28.53,"sellPrice":92.8,"profit":64.27,"multi":3.25,"saleDate":"12/09/2025","receiveDate":"01/10/2025","createdAt":"2025-09-12T00:00:00.000Z"},{"id":"s0527","productId":"468","buyPrice":14.29,"sellPrice":39.55,"profit":25.26,"multi":2.77,"saleDate":"13/09/2025","receiveDate":"01/10/2025","createdAt":"2025-09-13T00:00:00.000Z"},{"id":"s0528","productId":"450","buyPrice":45.53,"sellPrice":110.63,"profit":65.1,"multi":2.43,"saleDate":"10/09/2025","receiveDate":"01/10/2025","createdAt":"2025-09-10T00:00:00.000Z"},{"id":"s0529","productId":"452","buyPrice":21.84,"sellPrice":48.63,"profit":26.79,"multi":2.23,"saleDate":"11/09/2025","receiveDate":"02/10/2025","createdAt":"2025-09-11T00:00:00.000Z"},{"id":"s0530","productId":"367","buyPrice":20.44,"sellPrice":50.55,"profit":30.11,"multi":2.47,"saleDate":"03/09/2025","receiveDate":"02/10/2025","createdAt":"2025-09-03T00:00:00.000Z"},{"id":"s0531","productId":"98","buyPrice":14.97,"sellPrice":42.55,"profit":27.58,"multi":2.84,"saleDate":"06/09/2025","receiveDate":"02/10/2025","createdAt":"2025-09-06T00:00:00.000Z"},{"id":"s0532","productId":"7","buyPrice":12.81,"sellPrice":40.55,"profit":27.74,"multi":3.17,"saleDate":"11/09/2025","receiveDate":"02/10/2025","createdAt":"2025-09-11T00:00:00.000Z"},{"id":"s0533","productId":"392","buyPrice":20.89,"sellPrice":50.63,"profit":29.74,"multi":2.42,"saleDate":"11/09/2025","receiveDate":"03/10/2025","createdAt":"2025-09-11T00:00:00.000Z"},{"id":"s0534","productId":"325","buyPrice":20.27,"sellPrice":46.63,"profit":26.36,"multi":2.3,"saleDate":"15/09/2025","receiveDate":"03/10/2025","createdAt":"2025-09-15T00:00:00.000Z"},{"id":"s0535","productId":"462","buyPrice":29.36,"sellPrice":52.7,"profit":23.34,"multi":1.79,"saleDate":"12/09/2025","receiveDate":"03/10/2025","createdAt":"2025-09-12T00:00:00.000Z"},{"id":"s0536","productId":"418","buyPrice":24.69,"sellPrice":47.35,"profit":22.66,"multi":1.92,"saleDate":"13/09/2025","receiveDate":"03/10/2025","createdAt":"2025-09-13T00:00:00.000Z"},{"id":"s0537","productId":"460","buyPrice":10.18,"sellPrice":30.71,"profit":20.53,"multi":3.02,"saleDate":"12/08/2025","receiveDate":"03/10/2025","createdAt":"2025-08-12T00:00:00.000Z"},{"id":"s0538","productId":"155","buyPrice":25.89,"sellPrice":50.55,"profit":24.66,"multi":1.95,"saleDate":"13/09/2025","receiveDate":"03/10/2025","createdAt":"2025-09-13T00:00:00.000Z"},{"id":"s0539","productId":"413","buyPrice":21.64,"sellPrice":47.63,"profit":25.99,"multi":2.2,"saleDate":"14/09/2025","receiveDate":"03/10/2025","createdAt":"2025-09-14T00:00:00.000Z"},{"id":"s0540","productId":"55","buyPrice":6.8,"sellPrice":30.74,"profit":23.94,"multi":4.52,"saleDate":"13/09/2025","receiveDate":"06/10/2025","createdAt":"2025-09-13T00:00:00.000Z"},{"id":"s0541","productId":"497","buyPrice":14.19,"sellPrice":50.63,"profit":36.44,"multi":3.57,"saleDate":"16/09/2025","receiveDate":"06/10/2025","createdAt":"2025-09-16T00:00:00.000Z"},{"id":"s0542","productId":"476","buyPrice":15.49,"sellPrice":55.55,"profit":40.06,"multi":3.59,"saleDate":"15/09/2025","receiveDate":"06/10/2025","createdAt":"2025-09-15T00:00:00.000Z"},{"id":"s0543","productId":"13","buyPrice":31.01,"sellPrice":65.0,"profit":33.99,"multi":2.1,"saleDate":"17/09/2025","receiveDate":"06/10/2025","createdAt":"2025-09-17T00:00:00.000Z"},{"id":"s0544","productId":"359","buyPrice":14.09,"sellPrice":35.74,"profit":21.65,"multi":2.54,"saleDate":"17/09/2025","receiveDate":"07/10/2025","createdAt":"2025-09-17T00:00:00.000Z"},{"id":"s0545","productId":"160","buyPrice":20.6,"sellPrice":45.63,"profit":25.03,"multi":2.22,"saleDate":"11/09/2025","receiveDate":"07/10/2025","createdAt":"2025-09-11T00:00:00.000Z"},{"id":"s0546","productId":"458","buyPrice":16.59,"sellPrice":50.0,"profit":33.41,"multi":3.01,"saleDate":"17/09/2025","receiveDate":"07/10/2025","createdAt":"2025-09-17T00:00:00.000Z"},{"id":"s0547","productId":"245","buyPrice":10.25,"sellPrice":32.13,"profit":21.88,"multi":3.13,"saleDate":"19/09/2025","receiveDate":"07/10/2025","createdAt":"2025-09-19T00:00:00.000Z"},{"id":"s0548","productId":"271","buyPrice":14.48,"sellPrice":54.55,"profit":40.07,"multi":3.77,"saleDate":"17/09/2025","receiveDate":"07/10/2025","createdAt":"2025-09-17T00:00:00.000Z"},{"id":"s0549","productId":"484","buyPrice":10.34,"sellPrice":27.53,"profit":17.19,"multi":2.66,"saleDate":"14/09/2025","receiveDate":"07/10/2025","createdAt":"2025-09-14T00:00:00.000Z"},{"id":"s0550","productId":"463","buyPrice":22.9,"sellPrice":49.63,"profit":26.73,"multi":2.17,"saleDate":"17/09/2025","receiveDate":"07/10/2025","createdAt":"2025-09-17T00:00:00.000Z"},{"id":"s0551","productId":"334","buyPrice":20.27,"sellPrice":54.9,"profit":34.63,"multi":2.71,"saleDate":"21/09/2025","receiveDate":"08/10/2025","createdAt":"2025-09-21T00:00:00.000Z"},{"id":"s0552","productId":"454","buyPrice":16.43,"sellPrice":34.39,"profit":17.96,"multi":2.09,"saleDate":"16/09/2025","receiveDate":"08/10/2025","createdAt":"2025-09-16T00:00:00.000Z"},{"id":"s0553","productId":"457","buyPrice":16.39,"sellPrice":33.05,"profit":16.66,"multi":2.02,"saleDate":"20/09/2025","receiveDate":"08/10/2025","createdAt":"2025-09-20T00:00:00.000Z"},{"id":"s0554","productId":"546","buyPrice":16.69,"sellPrice":40.55,"profit":23.86,"multi":2.43,"saleDate":"21/09/2025","receiveDate":"08/10/2025","createdAt":"2025-09-21T00:00:00.000Z"},{"id":"s0555","productId":"169","buyPrice":19.54,"sellPrice":37.45,"profit":17.91,"multi":1.92,"saleDate":"13/09/2025","receiveDate":"24/08/2025","createdAt":"2025-09-13T00:00:00.000Z"},{"id":"s0556","productId":"529","buyPrice":21.94,"sellPrice":57.55,"profit":35.61,"multi":2.62,"saleDate":"18/09/2025","receiveDate":"08/10/2025","createdAt":"2025-09-18T00:00:00.000Z"},{"id":"s0557","productId":"249","buyPrice":19.54,"sellPrice":39.82,"profit":20.28,"multi":2.04,"saleDate":"17/09/2025","receiveDate":"08/10/2025","createdAt":"2025-09-17T00:00:00.000Z"},{"id":"s0558","productId":"522","buyPrice":24.51,"sellPrice":60.55,"profit":36.04,"multi":2.47,"saleDate":"20/09/2025","receiveDate":"09/10/2025","createdAt":"2025-09-20T00:00:00.000Z"},{"id":"s0559","productId":"493","buyPrice":15.09,"sellPrice":50.55,"profit":35.46,"multi":3.35,"saleDate":"14/09/2025","receiveDate":"09/10/2025","createdAt":"2025-09-14T00:00:00.000Z"},{"id":"s0560","productId":"515","buyPrice":25.98,"sellPrice":65.55,"profit":39.57,"multi":2.52,"saleDate":"20/09/2025","receiveDate":"09/10/2025","createdAt":"2025-09-20T00:00:00.000Z"},{"id":"s0561","productId":"499","buyPrice":25.74,"sellPrice":95.7,"profit":69.96,"multi":3.72,"saleDate":"17/09/2025","receiveDate":"10/10/2025","createdAt":"2025-09-17T00:00:00.000Z"},{"id":"s0562","productId":"543","buyPrice":14.19,"sellPrice":30.71,"profit":16.52,"multi":2.16,"saleDate":"21/09/2025","receiveDate":"10/10/2025","createdAt":"2025-09-21T00:00:00.000Z"},{"id":"s0563","productId":"118","buyPrice":9.68,"sellPrice":15.63,"profit":5.95,"multi":1.61,"saleDate":"19/09/2025","receiveDate":"10/10/2025","createdAt":"2025-09-19T00:00:00.000Z"},{"id":"s0564","productId":"352","buyPrice":19.54,"sellPrice":49.0,"profit":29.46,"multi":2.51,"saleDate":"19/09/2025","receiveDate":"17/10/2025","createdAt":"2025-09-19T00:00:00.000Z"},{"id":"s0565","productId":"540","buyPrice":14.99,"sellPrice":30.55,"profit":15.56,"multi":2.04,"saleDate":"21/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-21T00:00:00.000Z"},{"id":"s0566","productId":"500","buyPrice":14.99,"sellPrice":48.63,"profit":33.64,"multi":3.24,"saleDate":"18/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-18T00:00:00.000Z"},{"id":"s0567","productId":"183","buyPrice":31.13,"sellPrice":70.63,"profit":39.5,"multi":2.27,"saleDate":"23/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-23T00:00:00.000Z"},{"id":"s0568","productId":"65","buyPrice":22.94,"sellPrice":47.23,"profit":24.29,"multi":2.06,"saleDate":"24/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-24T00:00:00.000Z"},{"id":"s0569","productId":"78","buyPrice":19.36,"sellPrice":40.63,"profit":21.27,"multi":2.1,"saleDate":"24/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-24T00:00:00.000Z"},{"id":"s0570","productId":"137","buyPrice":20.25,"sellPrice":27.63,"profit":7.38,"multi":1.36,"saleDate":"22/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-22T00:00:00.000Z"},{"id":"s0571","productId":"165+486","buyPrice":34.98,"sellPrice":73.73,"profit":38.75,"multi":2.11,"saleDate":"17/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-17T00:00:00.000Z"},{"id":"s0572","productId":"351","buyPrice":14.34,"sellPrice":31.15,"profit":16.81,"multi":2.17,"saleDate":"22/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-22T00:00:00.000Z"},{"id":"s0573","productId":"526","buyPrice":16.49,"sellPrice":53.63,"profit":37.14,"multi":3.25,"saleDate":"21/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-21T00:00:00.000Z"},{"id":"s0574","productId":"550","buyPrice":25.49,"sellPrice":79.74,"profit":54.25,"multi":3.13,"saleDate":"21/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-21T00:00:00.000Z"},{"id":"s0575","productId":"548","buyPrice":23.22,"sellPrice":39.0,"profit":15.78,"multi":1.68,"saleDate":"22/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-22T00:00:00.000Z"},{"id":"s0576","productId":"470","buyPrice":25.71,"sellPrice":50.9,"profit":25.19,"multi":1.98,"saleDate":"14/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-14T00:00:00.000Z"},{"id":"s0577","productId":"380","buyPrice":14.48,"sellPrice":29.5,"profit":15.02,"multi":2.04,"saleDate":"21/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-21T00:00:00.000Z"},{"id":"s0578","productId":"390","buyPrice":15.09,"sellPrice":47.63,"profit":32.54,"multi":3.16,"saleDate":"24/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-24T00:00:00.000Z"},{"id":"s0579","productId":"563","buyPrice":17.47,"sellPrice":48.0,"profit":30.53,"multi":2.75,"saleDate":"22/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-22T00:00:00.000Z"},{"id":"s0580","productId":"557","buyPrice":28.32,"sellPrice":65.54,"profit":37.22,"multi":2.31,"saleDate":"21/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-21T00:00:00.000Z"},{"id":"s0581","productId":"6","buyPrice":11.22,"sellPrice":23.55,"profit":12.33,"multi":2.1,"saleDate":"22/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-22T00:00:00.000Z"},{"id":"s0582","productId":"524","buyPrice":20.24,"sellPrice":46.0,"profit":25.76,"multi":2.27,"saleDate":"21/09/2025","receiveDate":"13/10/2025","createdAt":"2025-09-21T00:00:00.000Z"},{"id":"s0583","productId":"416","buyPrice":15.39,"sellPrice":30.7,"profit":15.31,"multi":1.99,"saleDate":"23/09/2025","receiveDate":"14/10/2025","createdAt":"2025-09-23T00:00:00.000Z"},{"id":"s0584","productId":"189","buyPrice":14.89,"sellPrice":36.55,"profit":21.66,"multi":2.45,"saleDate":"24/09/2025","receiveDate":"14/10/2025","createdAt":"2025-09-24T00:00:00.000Z"},{"id":"s0585","productId":"455","buyPrice":18.54,"sellPrice":49.53,"profit":30.99,"multi":2.67,"saleDate":"23/09/2025","receiveDate":"14/10/2025","createdAt":"2025-09-23T00:00:00.000Z"},{"id":"s0586","productId":"560","buyPrice":13.71,"sellPrice":38.71,"profit":25.0,"multi":2.82,"saleDate":"22/09/2025","receiveDate":"14/10/2025","createdAt":"2025-09-22T00:00:00.000Z"},{"id":"s0587","productId":"421","buyPrice":18.49,"sellPrice":40.63,"profit":22.14,"multi":2.2,"saleDate":"24/09/2025","receiveDate":"14/10/2025","createdAt":"2025-09-24T00:00:00.000Z"},{"id":"s0588","productId":"527","buyPrice":14.19,"sellPrice":29.71,"profit":15.52,"multi":2.09,"saleDate":"22/09/2025","receiveDate":"14/10/2025","createdAt":"2025-09-22T00:00:00.000Z"},{"id":"s0589","productId":"481","buyPrice":25.81,"sellPrice":70.63,"profit":44.82,"multi":2.74,"saleDate":"22/09/2025","receiveDate":"14/10/2025","createdAt":"2025-09-22T00:00:00.000Z"},{"id":"s0590","productId":"195","buyPrice":14.19,"sellPrice":30.71,"profit":16.52,"multi":2.16,"saleDate":"22/09/2025","receiveDate":"15/10/2025","createdAt":"2025-09-22T00:00:00.000Z"},{"id":"s0591","productId":"485","buyPrice":12.01,"sellPrice":40.13,"profit":28.12,"multi":3.34,"saleDate":"26/09/2025","receiveDate":"15/10/2025","createdAt":"2025-09-26T00:00:00.000Z"},{"id":"s0592","productId":"591","buyPrice":21.7,"sellPrice":64.9,"profit":43.2,"multi":2.99,"saleDate":"27/09/2025","receiveDate":"15/10/2025","createdAt":"2025-09-27T00:00:00.000Z"},{"id":"s0593","productId":"446","buyPrice":15.99,"sellPrice":55.71,"profit":39.72,"multi":3.48,"saleDate":"24/09/2025","receiveDate":"15/10/2025","createdAt":"2025-09-24T00:00:00.000Z"},{"id":"s0594","productId":"575","buyPrice":12.74,"sellPrice":53.65,"profit":40.91,"multi":4.21,"saleDate":"26/09/2025","receiveDate":"15/10/2025","createdAt":"2025-09-26T00:00:00.000Z"},{"id":"s0595","productId":"275","buyPrice":22.34,"sellPrice":55.63,"profit":33.29,"multi":2.49,"saleDate":"26/09/2025","receiveDate":"15/10/2025","createdAt":"2025-09-26T00:00:00.000Z"},{"id":"s0596","productId":"138","buyPrice":18.05,"sellPrice":28.68,"profit":10.63,"multi":1.59,"saleDate":"24/09/2025","receiveDate":"15/10/2025","createdAt":"2025-09-24T00:00:00.000Z"},{"id":"s0597","productId":"81","buyPrice":20.1,"sellPrice":25.53,"profit":5.43,"multi":1.27,"saleDate":"23/09/2025","receiveDate":"16/10/2025","createdAt":"2025-09-23T00:00:00.000Z"},{"id":"s0598","productId":"521","buyPrice":40.93,"sellPrice":110.63,"profit":69.7,"multi":2.7,"saleDate":"24/09/2025","receiveDate":"16/10/2025","createdAt":"2025-09-24T00:00:00.000Z"},{"id":"s0599","productId":"519","buyPrice":26.49,"sellPrice":65.63,"profit":39.14,"multi":2.48,"saleDate":"17/09/2025","receiveDate":"18/10/2025","createdAt":"2025-09-17T00:00:00.000Z"},{"id":"s0600","productId":"488","buyPrice":1.0,"sellPrice":12.31,"profit":11.31,"multi":12.31,"saleDate":"28/09/2025","receiveDate":"17/10/2025","createdAt":"2025-09-28T00:00:00.000Z"},{"id":"s0601","productId":"214","buyPrice":19.34,"sellPrice":42.63,"profit":23.29,"multi":2.2,"saleDate":"29/09/2025","receiveDate":"17/10/2025","createdAt":"2025-09-29T00:00:00.000Z"},{"id":"s0602","productId":"494","buyPrice":15.39,"sellPrice":55.55,"profit":40.16,"multi":3.61,"saleDate":"24/09/2025","receiveDate":"17/10/2025","createdAt":"2025-09-24T00:00:00.000Z"},{"id":"s0603","productId":"93","buyPrice":7.55,"sellPrice":12.63,"profit":5.08,"multi":1.67,"saleDate":"01/10/2025","receiveDate":"20/10/2025","createdAt":"2025-10-01T00:00:00.000Z"},{"id":"s0604","productId":"542","buyPrice":9.04,"sellPrice":25.63,"profit":16.59,"multi":2.84,"saleDate":"28/09/2025","receiveDate":"20/10/2025","createdAt":"2025-09-28T00:00:00.000Z"},{"id":"s0605","productId":"502","buyPrice":19.19,"sellPrice":50.9,"profit":31.71,"multi":2.65,"saleDate":"24/09/2025","receiveDate":"20/10/2025","createdAt":"2025-09-24T00:00:00.000Z"},{"id":"s0606","productId":"578","buyPrice":12.66,"sellPrice":35.68,"profit":23.02,"multi":2.82,"saleDate":"26/09/2025","receiveDate":"20/10/2025","createdAt":"2025-09-26T00:00:00.000Z"},{"id":"s0607","productId":"89","buyPrice":17.0,"sellPrice":43.55,"profit":26.55,"multi":2.56,"saleDate":"28/09/2025","receiveDate":"20/10/2025","createdAt":"2025-09-28T00:00:00.000Z"},{"id":"s0608","productId":"428","buyPrice":18.51,"sellPrice":45.55,"profit":27.04,"multi":2.46,"saleDate":"26/09/2025","receiveDate":"20/10/2025","createdAt":"2025-09-26T00:00:00.000Z"},{"id":"s0609","productId":"507","buyPrice":23.25,"sellPrice":78.15,"profit":54.9,"multi":3.36,"saleDate":"29/09/2025","receiveDate":"20/10/2025","createdAt":"2025-09-29T00:00:00.000Z"},{"id":"s0610","productId":"511","buyPrice":18.69,"sellPrice":47.0,"profit":28.31,"multi":2.51,"saleDate":"29/09/2025","receiveDate":"20/10/2025","createdAt":"2025-09-29T00:00:00.000Z"},{"id":"s0611","productId":"427","buyPrice":22.61,"sellPrice":49.13,"profit":26.52,"multi":2.17,"saleDate":"27/09/2025","receiveDate":"20/10/2025","createdAt":"2025-09-27T00:00:00.000Z"},{"id":"s0612","productId":"592","buyPrice":13.99,"sellPrice":38.0,"profit":24.01,"multi":2.72,"saleDate":"30/09/2025","receiveDate":"20/10/2025","createdAt":"2025-09-30T00:00:00.000Z"},{"id":"s0613","productId":"423","buyPrice":14.79,"sellPrice":42.55,"profit":27.76,"multi":2.88,"saleDate":"24/09/2025","receiveDate":"20/10/2025","createdAt":"2025-09-24T00:00:00.000Z"},{"id":"s0614","productId":"505","buyPrice":15.19,"sellPrice":35.74,"profit":20.55,"multi":2.35,"saleDate":"01/10/2025","receiveDate":"20/10/2025","createdAt":"2025-10-01T00:00:00.000Z"},{"id":"s0615","productId":"449","buyPrice":16.59,"sellPrice":37.71,"profit":21.12,"multi":2.27,"saleDate":"28/09/2025","receiveDate":"21/10/2025","createdAt":"2025-09-28T00:00:00.000Z"},{"id":"s0616","productId":"237","buyPrice":27.45,"sellPrice":46.13,"profit":18.68,"multi":1.68,"saleDate":"24/09/2025","receiveDate":"21/10/2025","createdAt":"2025-09-24T00:00:00.000Z"},{"id":"s0617","productId":"605","buyPrice":15.59,"sellPrice":41.63,"profit":26.04,"multi":2.67,"saleDate":"28/09/2025","receiveDate":"21/10/2025","createdAt":"2025-09-28T00:00:00.000Z"},{"id":"s0618","productId":"264","buyPrice":22.88,"sellPrice":50.71,"profit":27.83,"multi":2.22,"saleDate":"28/09/2025","receiveDate":"21/10/2025","createdAt":"2025-09-28T00:00:00.000Z"},{"id":"s0619","productId":"63","buyPrice":20.4,"sellPrice":37.55,"profit":17.15,"multi":1.84,"saleDate":"29/09/2025","receiveDate":"21/10/2025","createdAt":"2025-09-29T00:00:00.000Z"},{"id":"s0620","productId":"594","buyPrice":1.0,"sellPrice":20.55,"profit":19.55,"multi":20.55,"saleDate":"30/09/2025","receiveDate":"21/10/2025","createdAt":"2025-09-30T00:00:00.000Z"},{"id":"s0621","productId":"607","buyPrice":21.6,"sellPrice":50.0,"profit":28.4,"multi":2.31,"saleDate":"03/10/2025","receiveDate":"22/10/2025","createdAt":"2025-10-03T00:00:00.000Z"},{"id":"s0622","productId":"508","buyPrice":8.78,"sellPrice":36.92,"profit":28.14,"multi":4.21,"saleDate":"29/09/2025","receiveDate":"22/10/2025","createdAt":"2025-09-29T00:00:00.000Z"},{"id":"s0623","productId":"617","buyPrice":20.6,"sellPrice":43.74,"profit":23.14,"multi":2.12,"saleDate":"30/09/2025","receiveDate":"23/10/2025","createdAt":"2025-09-30T00:00:00.000Z"},{"id":"s0624","productId":"474","buyPrice":20.34,"sellPrice":38.0,"profit":17.66,"multi":1.87,"saleDate":"02/10/2025","receiveDate":"23/10/2025","createdAt":"2025-10-02T00:00:00.000Z"},{"id":"s0625","productId":"506","buyPrice":15.29,"sellPrice":42.0,"profit":26.71,"multi":2.75,"saleDate":"30/09/2025","receiveDate":"23/10/2025","createdAt":"2025-09-30T00:00:00.000Z"},{"id":"s0626","productId":"545","buyPrice":11.49,"sellPrice":28.52,"profit":17.03,"multi":2.48,"saleDate":"28/09/2025","receiveDate":"23/10/2025","createdAt":"2025-09-28T00:00:00.000Z"},{"id":"s0627","productId":"582","buyPrice":15.39,"sellPrice":52.5,"profit":37.11,"multi":3.41,"saleDate":"28/09/2025","receiveDate":"23/10/2025","createdAt":"2025-09-28T00:00:00.000Z"},{"id":"s0628","productId":"603","buyPrice":15.49,"sellPrice":51.2,"profit":35.71,"multi":3.31,"saleDate":"27/09/2025","receiveDate":"23/10/2025","createdAt":"2025-09-27T00:00:00.000Z"},{"id":"s0629","productId":"650","buyPrice":13.88,"sellPrice":33.71,"profit":19.83,"multi":2.43,"saleDate":"04/10/2025","receiveDate":"23/10/2025","createdAt":"2025-10-04T00:00:00.000Z"},{"id":"s0630","productId":"298","buyPrice":11.49,"sellPrice":30.63,"profit":19.14,"multi":2.67,"saleDate":"27/09/2025","receiveDate":"23/10/2025","createdAt":"2025-09-27T00:00:00.000Z"},{"id":"s0631","productId":"284","buyPrice":15.09,"sellPrice":31.01,"profit":15.92,"multi":2.06,"saleDate":"04/10/2025","receiveDate":"23/10/2025","createdAt":"2025-10-04T00:00:00.000Z"},{"id":"s0632","productId":"477","buyPrice":52.14,"sellPrice":95.63,"profit":43.49,"multi":1.83,"saleDate":"30/09/2025","receiveDate":"23/10/2025","createdAt":"2025-09-30T00:00:00.000Z"},{"id":"s0633","productId":"489","buyPrice":11.67,"sellPrice":45.74,"profit":34.07,"multi":3.92,"saleDate":"02/10/2025","receiveDate":"24/10/2025","createdAt":"2025-10-02T00:00:00.000Z"},{"id":"s0634","productId":"590","buyPrice":31.34,"sellPrice":79.63,"profit":48.29,"multi":2.54,"saleDate":"28/09/2025","receiveDate":"24/10/2025","createdAt":"2025-09-28T00:00:00.000Z"},{"id":"s0635","productId":"579","buyPrice":20.6,"sellPrice":57.63,"profit":37.03,"multi":2.8,"saleDate":"04/10/2025","receiveDate":"24/10/2025","createdAt":"2025-10-04T00:00:00.000Z"},{"id":"s0636","productId":"653","buyPrice":14.99,"sellPrice":65.55,"profit":50.56,"multi":4.37,"saleDate":"04/10/2025","receiveDate":"24/10/2025","createdAt":"2025-10-04T00:00:00.000Z"},{"id":"s0637","productId":"611","buyPrice":25.49,"sellPrice":60.0,"profit":34.51,"multi":2.35,"saleDate":"04/10/2025","receiveDate":"24/10/2025","createdAt":"2025-10-04T00:00:00.000Z"},{"id":"s0638","productId":"366","buyPrice":19.44,"sellPrice":37.54,"profit":18.1,"multi":1.93,"saleDate":"30/09/2025","receiveDate":"24/10/2025","createdAt":"2025-09-30T00:00:00.000Z"},{"id":"s0639","productId":"539","buyPrice":26.21,"sellPrice":59.71,"profit":33.5,"multi":2.28,"saleDate":"04/10/2025","receiveDate":"24/10/2025","createdAt":"2025-10-04T00:00:00.000Z"},{"id":"s0640","productId":"559","buyPrice":15.96,"sellPrice":40.82,"profit":24.86,"multi":2.56,"saleDate":"03/10/2025","receiveDate":"27/10/2025","createdAt":"2025-10-03T00:00:00.000Z"},{"id":"s0641","productId":"656","buyPrice":22.68,"sellPrice":40.82,"profit":18.14,"multi":1.8,"saleDate":"04/10/2025","receiveDate":"27/10/2025","createdAt":"2025-10-04T00:00:00.000Z"},{"id":"s0642","productId":"77","buyPrice":25.21,"sellPrice":55.71,"profit":30.5,"multi":2.21,"saleDate":"01/10/2025","receiveDate":"27/10/2025","createdAt":"2025-10-01T00:00:00.000Z"},{"id":"s0643","productId":"577","buyPrice":12.74,"sellPrice":40.0,"profit":27.26,"multi":3.14,"saleDate":"01/10/2025","receiveDate":"27/10/2025","createdAt":"2025-10-01T00:00:00.000Z"},{"id":"s0644","productId":"437","buyPrice":14.09,"sellPrice":31.71,"profit":17.62,"multi":2.25,"saleDate":"20/09/2025","receiveDate":"27/10/2025","createdAt":"2025-09-20T00:00:00.000Z"},{"id":"s0645","productId":"24","buyPrice":15.39,"sellPrice":32.55,"profit":17.16,"multi":2.12,"saleDate":"27/09/2025","receiveDate":"27/10/2025","createdAt":"2025-09-27T00:00:00.000Z"},{"id":"s0646","productId":"657","buyPrice":14.09,"sellPrice":30.71,"profit":16.62,"multi":2.18,"saleDate":"04/10/2025","receiveDate":"27/10/2025","createdAt":"2025-10-04T00:00:00.000Z"},{"id":"s0647","productId":"640","buyPrice":9.64,"sellPrice":24.21,"profit":14.57,"multi":2.51,"saleDate":"04/10/2025","receiveDate":"27/10/2025","createdAt":"2025-10-04T00:00:00.000Z"},{"id":"s0648","productId":"643","buyPrice":25.3,"sellPrice":59.63,"profit":34.33,"multi":2.36,"saleDate":"05/10/2025","receiveDate":"27/10/2025","createdAt":"2025-10-05T00:00:00.000Z"},{"id":"s0649","productId":"588","buyPrice":19.49,"sellPrice":67.63,"profit":48.14,"multi":3.47,"saleDate":"05/10/2025","receiveDate":"27/10/2025","createdAt":"2025-10-05T00:00:00.000Z"},{"id":"s0650","productId":"255","buyPrice":1.0,"sellPrice":11.88,"profit":10.88,"multi":11.88,"saleDate":"03/10/2025","receiveDate":"28/10/2025","createdAt":"2025-10-03T00:00:00.000Z"},{"id":"s0651","productId":"606","buyPrice":14.09,"sellPrice":49.71,"profit":35.62,"multi":3.53,"saleDate":"05/10/2025","receiveDate":"28/10/2025","createdAt":"2025-10-05T00:00:00.000Z"},{"id":"s0652","productId":"288","buyPrice":12.99,"sellPrice":25.2,"profit":12.21,"multi":1.94,"saleDate":"04/10/2025","receiveDate":"28/10/2025","createdAt":"2025-10-04T00:00:00.000Z"},{"id":"s0653","productId":"633","buyPrice":23.46,"sellPrice":41.55,"profit":18.09,"multi":1.77,"saleDate":"06/10/2025","receiveDate":"28/10/2025","createdAt":"2025-10-06T00:00:00.000Z"},{"id":"s0654","productId":"648","buyPrice":14.99,"sellPrice":31.6,"profit":16.61,"multi":2.11,"saleDate":"05/10/2025","receiveDate":"28/10/2025","createdAt":"2025-10-05T00:00:00.000Z"},{"id":"s0655","productId":"649","buyPrice":8.67,"sellPrice":35.74,"profit":27.07,"multi":4.12,"saleDate":"05/10/2025","receiveDate":"28/10/2025","createdAt":"2025-10-05T00:00:00.000Z"},{"id":"s0656","productId":"610","buyPrice":19.56,"sellPrice":60.55,"profit":40.99,"multi":3.1,"saleDate":"02/10/2025","receiveDate":"29/10/2025","createdAt":"2025-10-02T00:00:00.000Z"},{"id":"s0657","productId":"147","buyPrice":9.14,"sellPrice":8.55,"profit":-0.59,"multi":0.94,"saleDate":"10/10/2025","receiveDate":"29/10/2025","createdAt":"2025-10-10T00:00:00.000Z"},{"id":"s0658","productId":"503","buyPrice":9.58,"sellPrice":55.55,"profit":45.97,"multi":5.8,"saleDate":"18/09/2025","receiveDate":"29/10/2025","createdAt":"2025-09-18T00:00:00.000Z"},{"id":"s0659","productId":"87","buyPrice":23.015,"sellPrice":51.69,"profit":28.67,"multi":2.25,"saleDate":"06/10/2025","receiveDate":"29/10/2025","createdAt":"2025-10-06T00:00:00.000Z"},{"id":"s0660","productId":"695","buyPrice":31.01,"sellPrice":55.53,"profit":24.52,"multi":1.79,"saleDate":"10/10/2025","receiveDate":"29/10/2025","createdAt":"2025-10-10T00:00:00.000Z"},{"id":"s0661","productId":"677","buyPrice":26.09,"sellPrice":60.85,"profit":34.76,"multi":2.33,"saleDate":"10/10/2025","receiveDate":"29/10/2025","createdAt":"2025-10-10T00:00:00.000Z"},{"id":"s0662","productId":"667","buyPrice":13.88,"sellPrice":30.55,"profit":16.67,"multi":2.2,"saleDate":"10/10/2025","receiveDate":"29/10/2025","createdAt":"2025-10-10T00:00:00.000Z"},{"id":"s0663","productId":"638","buyPrice":8.94,"sellPrice":25.71,"profit":16.77,"multi":2.88,"saleDate":"05/10/2025","receiveDate":"29/10/2025","createdAt":"2025-10-05T00:00:00.000Z"},{"id":"s0664","productId":"459","buyPrice":9.07,"sellPrice":34.55,"profit":25.48,"multi":3.81,"saleDate":"09/10/2025","receiveDate":"29/10/2025","createdAt":"2025-10-09T00:00:00.000Z"},{"id":"s0665","productId":"673","buyPrice":24.7,"sellPrice":40.55,"profit":15.85,"multi":1.64,"saleDate":"10/10/2025","receiveDate":"29/10/2025","createdAt":"2025-10-10T00:00:00.000Z"},{"id":"s0666","productId":"701","buyPrice":13.34,"sellPrice":35.85,"profit":22.51,"multi":2.69,"saleDate":"11/10/2025","receiveDate":"29/10/2025","createdAt":"2025-10-11T00:00:00.000Z"},{"id":"s0667","productId":"629","buyPrice":19.56,"sellPrice":40.82,"profit":21.26,"multi":2.09,"saleDate":"03/10/2025","receiveDate":"29/10/2025","createdAt":"2025-10-03T00:00:00.000Z"},{"id":"s0668","productId":"705","buyPrice":10.4,"sellPrice":25.74,"profit":15.34,"multi":2.47,"saleDate":"11/10/2025","receiveDate":"30/10/2025","createdAt":"2025-10-11T00:00:00.000Z"},{"id":"s0669","productId":"668","buyPrice":20.84,"sellPrice":50.0,"profit":29.16,"multi":2.4,"saleDate":"08/10/2025","receiveDate":"30/10/2025","createdAt":"2025-10-08T00:00:00.000Z"},{"id":"s0670","productId":"647","buyPrice":21.6,"sellPrice":40.71,"profit":19.11,"multi":1.88,"saleDate":"07/10/2025","receiveDate":"30/10/2025","createdAt":"2025-10-07T00:00:00.000Z"},{"id":"s0671","productId":"669","buyPrice":25.31,"sellPrice":45.55,"profit":20.24,"multi":1.8,"saleDate":"09/10/2025","receiveDate":"30/10/2025","createdAt":"2025-10-09T00:00:00.000Z"},{"id":"s0672","productId":"684","buyPrice":10.18,"sellPrice":30.74,"profit":20.56,"multi":3.02,"saleDate":"09/10/2025","receiveDate":"30/10/2025","createdAt":"2025-10-09T00:00:00.000Z"},{"id":"s0673","productId":"562","buyPrice":22.04,"sellPrice":41.05,"profit":19.01,"multi":1.86,"saleDate":"08/10/2025","receiveDate":"30/10/2025","createdAt":"2025-10-08T00:00:00.000Z"},{"id":"s0674","productId":"593","buyPrice":18.57,"sellPrice":45.77,"profit":27.2,"multi":2.46,"saleDate":"13/10/2025","receiveDate":"31/10/2025","createdAt":"2025-10-13T00:00:00.000Z"},{"id":"s0675","productId":"623","buyPrice":17.69,"sellPrice":47.35,"profit":29.66,"multi":2.68,"saleDate":"02/10/2025","receiveDate":"31/10/2025","createdAt":"2025-10-02T00:00:00.000Z"},{"id":"s0676","productId":"655","buyPrice":17.47,"sellPrice":38.2,"profit":20.73,"multi":2.19,"saleDate":"06/10/2025","receiveDate":"31/10/2025","createdAt":"2025-10-06T00:00:00.000Z"},{"id":"s0677","productId":"99","buyPrice":13.945,"sellPrice":15.71,"profit":1.77,"multi":1.13,"saleDate":"07/10/2025","receiveDate":"31/10/2025","createdAt":"2025-10-07T00:00:00.000Z"},{"id":"s0678","productId":"331","buyPrice":13.85,"sellPrice":30.55,"profit":16.7,"multi":2.21,"saleDate":"11/10/2025","receiveDate":"31/10/2025","createdAt":"2025-10-11T00:00:00.000Z"},{"id":"s0679","productId":"290","buyPrice":20.0,"sellPrice":41.8,"profit":21.8,"multi":2.09,"saleDate":"07/10/205","receiveDate":"31/10/2025","createdAt":"2025-01-01T00:00:00.000Z"},{"id":"s0680","productId":"695","buyPrice":31.01,"sellPrice":45.55,"profit":14.54,"multi":1.47,"saleDate":"12/10/2025","receiveDate":"03/11/2025","createdAt":"2025-10-12T00:00:00.000Z"},{"id":"s0681","productId":"690","buyPrice":24.51,"sellPrice":48.63,"profit":24.12,"multi":1.98,"saleDate":"13/10/2025","receiveDate":"03/11/2025","createdAt":"2025-10-13T00:00:00.000Z"},{"id":"s0682","productId":"665","buyPrice":24.7,"sellPrice":54.77,"profit":30.07,"multi":2.22,"saleDate":"13/10/2025","receiveDate":"03/11/2025","createdAt":"2025-10-13T00:00:00.000Z"},{"id":"s0683","productId":"634","buyPrice":34.92,"sellPrice":55.63,"profit":20.71,"multi":1.59,"saleDate":"14/10/2025","receiveDate":"03/11/2025","createdAt":"2025-10-14T00:00:00.000Z"},{"id":"s0684","productId":"630","buyPrice":15.09,"sellPrice":61.63,"profit":46.54,"multi":4.08,"saleDate":"12/10/2025","receiveDate":"03/11/2025","createdAt":"2025-10-12T00:00:00.000Z"},{"id":"s0685","productId":"652","buyPrice":29.2,"sellPrice":64.55,"profit":35.35,"multi":2.21,"saleDate":"05/10/2025","receiveDate":"03/11/2025","createdAt":"2025-10-05T00:00:00.000Z"},{"id":"s0686","productId":"67","buyPrice":23.015,"sellPrice":40.82,"profit":17.8,"multi":1.77,"saleDate":"11/10/2025","receiveDate":"03/11/2025","createdAt":"2025-10-11T00:00:00.000Z"},{"id":"s0687","productId":"706","buyPrice":10.4,"sellPrice":36.3,"profit":25.9,"multi":3.49,"saleDate":"11/10/2025","receiveDate":"03/11/2025","createdAt":"2025-10-11T00:00:00.000Z"},{"id":"s0688","productId":"370","buyPrice":48.46,"sellPrice":107.9,"profit":59.44,"multi":2.23,"saleDate":"29/09/2025","receiveDate":"03/11/2025","createdAt":"2025-09-29T00:00:00.000Z"},{"id":"s0689","productId":"732","buyPrice":14.28,"sellPrice":33.55,"profit":19.27,"multi":2.35,"saleDate":"14/10/2025","receiveDate":"03/11/2025","createdAt":"2025-10-14T00:00:00.000Z"},{"id":"s0690","productId":"708","buyPrice":42.43,"sellPrice":88.63,"profit":46.2,"multi":2.09,"saleDate":"13/10/2025","receiveDate":"04/11/2025","createdAt":"2025-10-13T00:00:00.000Z"},{"id":"s0691","productId":"730","buyPrice":14.89,"sellPrice":30.0,"profit":15.11,"multi":2.01,"saleDate":"12/10/2025","receiveDate":"04/11/2025","createdAt":"2025-10-12T00:00:00.000Z"},{"id":"s0692","productId":"646","buyPrice":20.34,"sellPrice":75.0,"profit":54.66,"multi":3.69,"saleDate":"15/10/2025","receiveDate":"04/11/2025","createdAt":"2025-10-15T00:00:00.000Z"},{"id":"s0693","productId":"743","buyPrice":24.3,"sellPrice":48.63,"profit":24.33,"multi":2.0,"saleDate":"12/10/2025","receiveDate":"04/11/2025","createdAt":"2025-10-12T00:00:00.000Z"},{"id":"s0694","productId":"686","buyPrice":24.51,"sellPrice":51.2,"profit":26.69,"multi":2.09,"saleDate":"11/10/2025","receiveDate":"04/11/2025","createdAt":"2025-10-11T00:00:00.000Z"},{"id":"s0695","productId":"738","buyPrice":24.3,"sellPrice":49.55,"profit":25.25,"multi":2.04,"saleDate":"16/10/2025","receiveDate":"05/11/2025","createdAt":"2025-10-16T00:00:00.000Z"},{"id":"s0696","productId":"736","buyPrice":25.0,"sellPrice":46.55,"profit":21.55,"multi":1.86,"saleDate":"15/10/2025","receiveDate":"05/11/2025","createdAt":"2025-10-15T00:00:00.000Z"},{"id":"s0697","productId":"432","buyPrice":17.805,"sellPrice":41.27,"profit":23.47,"multi":2.32,"saleDate":"11/10/2025","receiveDate":"05/11/2025","createdAt":"2025-10-11T00:00:00.000Z"},{"id":"s0698","productId":"734 et 770","buyPrice":50.81,"sellPrice":85.75,"profit":34.94,"multi":1.69,"saleDate":"17/10/2025","receiveDate":"05/11/2025","createdAt":"2025-10-17T00:00:00.000Z"},{"id":"s0699","productId":"721","buyPrice":25.0,"sellPrice":55.53,"profit":30.53,"multi":2.22,"saleDate":"14/10/2025","receiveDate":"05/11/2025","createdAt":"2025-10-14T00:00:00.000Z"},{"id":"s0700","productId":"775","buyPrice":20.0,"sellPrice":35.63,"profit":15.63,"multi":1.78,"saleDate":"16/10/2025","receiveDate":"05/11/2025","createdAt":"2025-10-16T00:00:00.000Z"},{"id":"s0701","productId":"475","buyPrice":11.44,"sellPrice":50.73,"profit":39.29,"multi":4.43,"saleDate":"13/10/2025","receiveDate":"05/11/2025","createdAt":"2025-10-13T00:00:00.000Z"},{"id":"s0702","productId":"726","buyPrice":17.0,"sellPrice":35.55,"profit":18.55,"multi":2.09,"saleDate":"14/10/2025","receiveDate":"06/11/2025","createdAt":"2025-10-14T00:00:00.000Z"},{"id":"s0703","productId":"765","buyPrice":25.0,"sellPrice":49.82,"profit":24.82,"multi":1.99,"saleDate":"17/10/2025","receiveDate":"06/11/2025","createdAt":"2025-10-17T00:00:00.000Z"},{"id":"s0704","productId":"Onitsuka tiger","buyPrice":30.0,"sellPrice":85.74,"profit":55.74,"multi":2.86,"saleDate":"15/10/2025","receiveDate":"06/11/2025","createdAt":"2025-10-15T00:00:00.000Z"},{"id":"s0705","productId":"790","buyPrice":25.0,"sellPrice":53.05,"profit":28.05,"multi":2.12,"saleDate":"19/10/2025","receiveDate":"07/11/2025","createdAt":"2025-10-19T00:00:00.000Z"},{"id":"s0706","productId":"717","buyPrice":25.81,"sellPrice":57.77,"profit":31.96,"multi":2.24,"saleDate":"20/10/2025","receiveDate":"07/11/2025","createdAt":"2025-10-20T00:00:00.000Z"},{"id":"s0707","productId":"811","buyPrice":25.0,"sellPrice":47.37,"profit":22.37,"multi":1.89,"saleDate":"19/10/2025","receiveDate":"07/11/2025","createdAt":"2025-10-19T00:00:00.000Z"},{"id":"s0708","productId":"733","buyPrice":25.31,"sellPrice":51.2,"profit":25.89,"multi":2.02,"saleDate":"12/10/2025","receiveDate":"07/11/2025","createdAt":"2025-10-12T00:00:00.000Z"},{"id":"s0709","productId":"704","buyPrice":10.4,"sellPrice":30.2,"profit":19.8,"multi":2.9,"saleDate":"11/10/2025","receiveDate":"07/11/2025","createdAt":"2025-10-11T00:00:00.000Z"},{"id":"s0710","productId":"801","buyPrice":25.0,"sellPrice":49.55,"profit":24.55,"multi":1.98,"saleDate":"20/10/2025","receiveDate":"07/11/2025","createdAt":"2025-10-20T00:00:00.000Z"},{"id":"s0711","productId":"818","buyPrice":22.0,"sellPrice":49.05,"profit":27.05,"multi":2.23,"saleDate":"19/10/2025","receiveDate":"07/11/2025","createdAt":"2025-10-19T00:00:00.000Z"},{"id":"s0712","productId":"794","buyPrice":25.0,"sellPrice":48.78,"profit":23.78,"multi":1.95,"saleDate":"20/10/2025","receiveDate":"07/11/2025","createdAt":"2025-10-20T00:00:00.000Z"},{"id":"s0713","productId":"604 et  263","buyPrice":43.4,"sellPrice":84.63,"profit":41.23,"multi":1.95,"saleDate":"19/10/2025","receiveDate":"07/11/2025","createdAt":"2025-10-19T00:00:00.000Z"},{"id":"s0714","productId":"786","buyPrice":25.0,"sellPrice":47.35,"profit":22.35,"multi":1.89,"saleDate":"20/10/2025","receiveDate":"10/11/2025","createdAt":"2025-10-20T00:00:00.000Z"},{"id":"s0715","productId":"762","buyPrice":25.49,"sellPrice":49.71,"profit":24.22,"multi":1.95,"saleDate":"16/10/2025","receiveDate":"10/11/2025","createdAt":"2025-10-16T00:00:00.000Z"},{"id":"s0716","productId":"531","buyPrice":13.88,"sellPrice":49.13,"profit":35.25,"multi":3.54,"saleDate":"18/10/2025","receiveDate":"10/11/2025","createdAt":"2025-10-18T00:00:00.000Z"},{"id":"s0717","productId":"755","buyPrice":25.0,"sellPrice":50.73,"profit":25.73,"multi":2.03,"saleDate":"19/10/2025","receiveDate":"11/11/2025","createdAt":"2025-10-19T00:00:00.000Z"},{"id":"s0718","productId":"792","buyPrice":24.0,"sellPrice":50.53,"profit":26.53,"multi":2.11,"saleDate":"21/10/2025","receiveDate":"11/11/2025","createdAt":"2025-10-21T00:00:00.000Z"},{"id":"s0719","productId":"728","buyPrice":25.31,"sellPrice":50.55,"profit":25.24,"multi":2.0,"saleDate":"21/10/2025","receiveDate":"12/11/2025","createdAt":"2025-10-21T00:00:00.000Z"},{"id":"s0720","productId":"788","buyPrice":25.0,"sellPrice":50.53,"profit":25.53,"multi":2.02,"saleDate":"19/10/2025","receiveDate":"12/11/2025","createdAt":"2025-10-19T00:00:00.000Z"},{"id":"s0721","productId":"712","buyPrice":25.81,"sellPrice":48.55,"profit":22.74,"multi":1.88,"saleDate":"24/10/2025","receiveDate":"12/11/2025","createdAt":"2025-10-24T00:00:00.000Z"},{"id":"s0722","productId":"780","buyPrice":20.4,"sellPrice":60.82,"profit":40.42,"multi":2.98,"saleDate":"23/10/2025","receiveDate":"13/11/2025","createdAt":"2025-10-23T00:00:00.000Z"},{"id":"s0723","productId":"635","buyPrice":15.88,"sellPrice":50.63,"profit":34.75,"multi":3.19,"saleDate":"22/10/2025","receiveDate":"13/11/2025","createdAt":"2025-10-22T00:00:00.000Z"},{"id":"s0724","productId":"799","buyPrice":35.72,"sellPrice":69.75,"profit":34.03,"multi":1.95,"saleDate":"20/10/2025","receiveDate":"13/11/2025","createdAt":"2025-10-20T00:00:00.000Z"},{"id":"s0725","productId":"772","buyPrice":14.29,"sellPrice":46.31,"profit":32.02,"multi":3.24,"saleDate":"25/10/2025","receiveDate":"14/11/2025","createdAt":"2025-10-25T00:00:00.000Z"},{"id":"s0726","productId":"670","buyPrice":19.49,"sellPrice":35.77,"profit":16.28,"multi":1.84,"saleDate":"27/10/2025","receiveDate":"14/11/2025","createdAt":"2025-10-27T00:00:00.000Z"},{"id":"s0727","productId":"585","buyPrice":21.84,"sellPrice":32.63,"profit":10.79,"multi":1.49,"saleDate":"26/10/2025","receiveDate":"14/11/2025","createdAt":"2025-10-26T00:00:00.000Z"},{"id":"s0728","productId":"217","buyPrice":23.39,"sellPrice":42.53,"profit":19.14,"multi":1.82,"saleDate":"24/10/2025","receiveDate":"14/11/2025","createdAt":"2025-10-24T00:00:00.000Z"},{"id":"s0729","productId":"744","buyPrice":25.0,"sellPrice":50.55,"profit":25.55,"multi":2.02,"saleDate":"25/10/2025","receiveDate":"14/11/2025","createdAt":"2025-10-25T00:00:00.000Z"},{"id":"s0730","productId":"846","buyPrice":25.54,"sellPrice":45.75,"profit":20.21,"multi":1.79,"saleDate":"28/10/2025","receiveDate":"14/11/2025","createdAt":"2025-10-28T00:00:00.000Z"},{"id":"s0731","productId":"479","buyPrice":26.21,"sellPrice":52.53,"profit":26.32,"multi":2.0,"saleDate":"24/10/2025","receiveDate":"17/11/2025","createdAt":"2025-10-24T00:00:00.000Z"},{"id":"s0732","productId":"825","buyPrice":19.6,"sellPrice":62.77,"profit":43.17,"multi":3.2,"saleDate":"28/10/2025","receiveDate":"17/11/2025","createdAt":"2025-10-28T00:00:00.000Z"},{"id":"s0733","productId":"520","buyPrice":32.34,"sellPrice":70.87,"profit":38.53,"multi":2.19,"saleDate":"29/10/2025","receiveDate":"17/11/2025","createdAt":"2025-10-29T00:00:00.000Z"},{"id":"s0734","productId":"621","buyPrice":26.85,"sellPrice":49.55,"profit":22.7,"multi":1.85,"saleDate":"25/10/2025","receiveDate":"17/11/2025","createdAt":"2025-10-25T00:00:00.000Z"},{"id":"s0735","productId":"651","buyPrice":34.92,"sellPrice":66.37,"profit":31.45,"multi":1.9,"saleDate":"29/10/2025","receiveDate":"17/11/2025","createdAt":"2025-10-29T00:00:00.000Z"},{"id":"s0736","productId":"866","buyPrice":8.6,"sellPrice":25.63,"profit":17.03,"multi":2.98,"saleDate":"28/10/2025","receiveDate":"17/11/2025","createdAt":"2025-10-28T00:00:00.000Z"},{"id":"s0737","productId":"883","buyPrice":16.39,"sellPrice":47.43,"profit":31.04,"multi":2.89,"saleDate":"29/10/2025","receiveDate":"17/11/2025","createdAt":"2025-10-29T00:00:00.000Z"},{"id":"s0738","productId":"660","buyPrice":19.69,"sellPrice":67.63,"profit":47.94,"multi":3.43,"saleDate":"28/10/2025","receiveDate":"17/11/2025","createdAt":"2025-10-28T00:00:00.000Z"},{"id":"s0739","productId":"834","buyPrice":24.3,"sellPrice":55.55,"profit":31.25,"multi":2.29,"saleDate":"29/10/2025","receiveDate":"18/11/2025","createdAt":"2025-10-29T00:00:00.000Z"},{"id":"s0740","productId":"795","buyPrice":25.0,"sellPrice":52.55,"profit":27.55,"multi":2.1,"saleDate":"29/10/2025","receiveDate":"18/11/2025","createdAt":"2025-10-29T00:00:00.000Z"},{"id":"s0741","productId":"659","buyPrice":56.56,"sellPrice":95.0,"profit":38.44,"multi":1.68,"saleDate":"30/10/2025","receiveDate":"18/11/2025","createdAt":"2025-10-30T00:00:00.000Z"},{"id":"s0742","productId":"41","buyPrice":15.39,"sellPrice":25.5,"profit":10.11,"multi":1.66,"saleDate":"28/10/2025","receiveDate":"18/11/2025","createdAt":"2025-10-28T00:00:00.000Z"},{"id":"s0743","productId":"789","buyPrice":25.0,"sellPrice":46.2,"profit":21.2,"multi":1.85,"saleDate":"28/10/2025","receiveDate":"19/11/2025","createdAt":"2025-10-28T00:00:00.000Z"},{"id":"s0744","productId":"535","buyPrice":16.46,"sellPrice":49.63,"profit":33.17,"multi":3.02,"saleDate":"28/10/2025","receiveDate":"19/11/2025","createdAt":"2025-10-28T00:00:00.000Z"},{"id":"s0745","productId":"735","buyPrice":26.81,"sellPrice":50.71,"profit":23.9,"multi":1.89,"saleDate":"22/10/2025","receiveDate":"19/11/2025","createdAt":"2025-10-22T00:00:00.000Z"},{"id":"s0746","productId":"871","buyPrice":24.67,"sellPrice":45.63,"profit":20.96,"multi":1.85,"saleDate":"28/10/2025","receiveDate":"19/11/2025","createdAt":"2025-10-28T00:00:00.000Z"},{"id":"s0747","productId":"664","buyPrice":25.31,"sellPrice":47.54,"profit":22.23,"multi":1.88,"saleDate":"29/10/2025","receiveDate":"19/11/2025","createdAt":"2025-10-29T00:00:00.000Z"},{"id":"s0748","productId":"492","buyPrice":7.19,"sellPrice":15.01,"profit":7.82,"multi":2.09,"saleDate":"31/10/2025","receiveDate":"20/11/2025","createdAt":"2025-10-31T00:00:00.000Z"},{"id":"s0749","productId":"827","buyPrice":23.8,"sellPrice":55.63,"profit":31.83,"multi":2.34,"saleDate":"29/10/2025","receiveDate":"20/11/2025","createdAt":"2025-10-29T00:00:00.000Z"},{"id":"s0750","productId":"850","buyPrice":26.81,"sellPrice":52.54,"profit":25.73,"multi":1.96,"saleDate":"28/10/2025","receiveDate":"20/11/2025","createdAt":"2025-10-28T00:00:00.000Z"},{"id":"s0751","productId":"558","buyPrice":26.01,"sellPrice":25.71,"profit":-0.3,"multi":0.99,"saleDate":"29/10/2025","receiveDate":"20/11/2025","createdAt":"2025-10-29T00:00:00.000Z"},{"id":"s0752","productId":"70","buyPrice":8.88,"sellPrice":22.73,"profit":13.85,"multi":2.56,"saleDate":"29/10/2025","receiveDate":"21/11/2025","createdAt":"2025-10-29T00:00:00.000Z"},{"id":"s0753","productId":"624","buyPrice":5.8,"sellPrice":37.63,"profit":31.83,"multi":6.49,"saleDate":"30/10/2025","receiveDate":"21/11/2025","createdAt":"2025-10-30T00:00:00.000Z"},{"id":"s0754","productId":"797","buyPrice":24.0,"sellPrice":49.55,"profit":25.55,"multi":2.06,"saleDate":"31/10/2025","receiveDate":"21/11/2025","createdAt":"2025-10-31T00:00:00.000Z"},{"id":"s0755","productId":"895","buyPrice":30.4,"sellPrice":55.5,"profit":25.1,"multi":1.83,"saleDate":"31/10/2025","receiveDate":"25/11/2025","createdAt":"2025-10-31T00:00:00.000Z"},{"id":"s0756","productId":"821","buyPrice":11.41,"sellPrice":48.63,"profit":37.22,"multi":4.26,"saleDate":"03/11/2025","receiveDate":"21/11/2025","createdAt":"2025-11-03T00:00:00.000Z"},{"id":"s0757","productId":"841","buyPrice":10.45,"sellPrice":30.71,"profit":20.26,"multi":2.94,"saleDate":"29/10/2025","receiveDate":"21/11/2025","createdAt":"2025-10-29T00:00:00.000Z"},{"id":"s0758","productId":"383","buyPrice":13.71,"sellPrice":50.5,"profit":36.79,"multi":3.68,"saleDate":"01/11/2025","receiveDate":"21/11/2025","createdAt":"2025-11-01T00:00:00.000Z"},{"id":"s0759","productId":"897","buyPrice":35.72,"sellPrice":85.48,"profit":49.76,"multi":2.39,"saleDate":"02/11/2025","receiveDate":"21/11/2025","createdAt":"2025-11-02T00:00:00.000Z"},{"id":"s0760","productId":"709","buyPrice":14.89,"sellPrice":41.71,"profit":26.82,"multi":2.8,"saleDate":"03/11/2025","receiveDate":"21/11/2025","createdAt":"2025-11-03T00:00:00.000Z"},{"id":"s0761","productId":"852","buyPrice":11.0,"sellPrice":20.63,"profit":9.63,"multi":1.88,"saleDate":"27/10/2025","receiveDate":"21/11/2025","createdAt":"2025-10-27T00:00:00.000Z"},{"id":"s0762","productId":"523","buyPrice":24.91,"sellPrice":45.0,"profit":20.09,"multi":1.81,"saleDate":"26/10/2025","receiveDate":"24/11/2025","createdAt":"2025-10-26T00:00:00.000Z"},{"id":"s0763","productId":"893","buyPrice":16.51,"sellPrice":50.17,"profit":33.66,"multi":3.04,"saleDate":"04/11/2025","receiveDate":"24/11/2025","createdAt":"2025-11-04T00:00:00.000Z"},{"id":"s0764","productId":"512","buyPrice":15.79,"sellPrice":31.71,"profit":15.92,"multi":2.01,"saleDate":"01/11/2025","receiveDate":"24/11/2025","createdAt":"2025-11-01T00:00:00.000Z"},{"id":"s0765","productId":"731","buyPrice":16.7,"sellPrice":44.55,"profit":27.85,"multi":2.67,"saleDate":"04/11/2025","receiveDate":"24/11/2025","createdAt":"2025-11-04T00:00:00.000Z"},{"id":"s0766","productId":"319","buyPrice":32.06,"sellPrice":44.48,"profit":12.42,"multi":1.39,"saleDate":"03/11/2025","receiveDate":"24/11/2025","createdAt":"2025-11-03T00:00:00.000Z"},{"id":"s0767","productId":"853","buyPrice":20.0,"sellPrice":40.63,"profit":20.63,"multi":2.03,"saleDate":"30/10/2025","receiveDate":"24/11/2025","createdAt":"2025-10-30T00:00:00.000Z"},{"id":"s0768","productId":"816","buyPrice":20.0,"sellPrice":40.63,"profit":20.63,"multi":2.03,"saleDate":"02/11/2025","receiveDate":"24/11/2025","createdAt":"2025-11-02T00:00:00.000Z"},{"id":"s0769","productId":"269","buyPrice":14.99,"sellPrice":46.75,"profit":31.76,"multi":3.12,"saleDate":"01/11/2025","receiveDate":"24/11/2025","createdAt":"2025-11-01T00:00:00.000Z"},{"id":"s0770","productId":"236","buyPrice":27.45,"sellPrice":30.63,"profit":3.18,"multi":1.12,"saleDate":"05/11/2025","receiveDate":"24/11/2025","createdAt":"2025-11-05T00:00:00.000Z"},{"id":"s0771","productId":"913","buyPrice":16.59,"sellPrice":45.85,"profit":29.26,"multi":2.76,"saleDate":"02/11/2025","receiveDate":"24/11/2025","createdAt":"2025-11-02T00:00:00.000Z"},{"id":"s0772","productId":"883","buyPrice":16.39,"sellPrice":52.63,"profit":36.24,"multi":3.21,"saleDate":"03/11/2025","receiveDate":"24/11/2025","createdAt":"2025-11-03T00:00:00.000Z"},{"id":"s0773","productId":"868","buyPrice":23.0,"sellPrice":45.71,"profit":22.71,"multi":1.99,"saleDate":"31/10/2025","receiveDate":"24/11/2025","createdAt":"2025-10-31T00:00:00.000Z"},{"id":"s0774","productId":"832","buyPrice":24.31,"sellPrice":50.71,"profit":26.4,"multi":2.09,"saleDate":"29/10/2025","receiveDate":"24/11/2025","createdAt":"2025-10-29T00:00:00.000Z"},{"id":"s0775","productId":"753","buyPrice":25.0,"sellPrice":45.73,"profit":20.73,"multi":1.83,"saleDate":"02/11/2025","receiveDate":"25/11/2025","createdAt":"2025-11-02T00:00:00.000Z"},{"id":"s0776","productId":"441","buyPrice":14.99,"sellPrice":25.74,"profit":10.75,"multi":1.72,"saleDate":"29/10/2025","receiveDate":"25/11/2025","createdAt":"2025-10-29T00:00:00.000Z"},{"id":"s0777","productId":"836","buyPrice":16.39,"sellPrice":40.71,"profit":24.32,"multi":2.48,"saleDate":"05/11/2025","receiveDate":"25/11/2025","createdAt":"2025-11-05T00:00:00.000Z"},{"id":"s0778","productId":"836","buyPrice":16.39,"sellPrice":45.71,"profit":29.32,"multi":2.79,"saleDate":"05/11/2025","receiveDate":"25/11/2025","createdAt":"2025-11-05T00:00:00.000Z"},{"id":"s0779","productId":"408","buyPrice":14.79,"sellPrice":46.95,"profit":32.16,"multi":3.17,"saleDate":"02/11/2025","receiveDate":"25/11/2025","createdAt":"2025-11-02T00:00:00.000Z"},{"id":"s0780","productId":"899","buyPrice":22.0,"sellPrice":45.74,"profit":23.74,"multi":2.08,"saleDate":"03/11/2025","receiveDate":"25/11/2025","createdAt":"2025-11-03T00:00:00.000Z"},{"id":"s0781","productId":"193","buyPrice":17.19,"sellPrice":31.2,"profit":14.01,"multi":1.82,"saleDate":"01/11/2025","receiveDate":"26/11/2025","createdAt":"2025-11-01T00:00:00.000Z"},{"id":"s0782","productId":"672","buyPrice":24.51,"sellPrice":45.75,"profit":21.24,"multi":1.87,"saleDate":"04/11/2025","receiveDate":"26/11/2025","createdAt":"2025-11-04T00:00:00.000Z"},{"id":"s0783","productId":"384","buyPrice":20.0,"sellPrice":59.0,"profit":39.0,"multi":2.95,"saleDate":"02/11/2025","receiveDate":"26/11/2025","createdAt":"2025-11-02T00:00:00.000Z"},{"id":"s0784","productId":"823","buyPrice":21.6,"sellPrice":52.73,"profit":31.13,"multi":2.44,"saleDate":"30/10/2025","receiveDate":"27/11/2025","createdAt":"2025-10-30T00:00:00.000Z"},{"id":"s0785","productId":"720","buyPrice":36.42,"sellPrice":65.85,"profit":29.43,"multi":1.81,"saleDate":"05/11/2025","receiveDate":"27/11/2025","createdAt":"2025-11-05T00:00:00.000Z"},{"id":"s0786","productId":"694","buyPrice":30.97,"sellPrice":64.25,"profit":33.28,"multi":2.07,"saleDate":"04/11/2025","receiveDate":"27/11/2025","createdAt":"2025-11-04T00:00:00.000Z"},{"id":"s0787","productId":"330","buyPrice":14.35,"sellPrice":28.21,"profit":13.86,"multi":1.97,"saleDate":"28/10/2025","receiveDate":"27/11/2025","createdAt":"2025-10-28T00:00:00.000Z"},{"id":"s0788","productId":"air max","buyPrice":15.0,"sellPrice":15.71,"profit":0.71,"multi":1.05,"saleDate":"05/11/2025","receiveDate":"27/11/2025","createdAt":"2025-11-05T00:00:00.000Z"},{"id":"s0789","productId":"553","buyPrice":15.96,"sellPrice":31.29,"profit":15.33,"multi":1.96,"saleDate":"08/11/2025","receiveDate":"28/11/2025","createdAt":"2025-11-08T00:00:00.000Z"},{"id":"s0790","productId":"556","buyPrice":21.0,"sellPrice":35.77,"profit":14.77,"multi":1.7,"saleDate":"12/11/2025","receiveDate":"01/12/2025","createdAt":"2025-11-12T00:00:00.000Z"},{"id":"s0791","productId":"879","buyPrice":22.61,"sellPrice":42.55,"profit":19.94,"multi":1.88,"saleDate":"07/11/2025","receiveDate":"01/12/2025","createdAt":"2025-11-07T00:00:00.000Z"},{"id":"s0792","productId":"697","buyPrice":26.91,"sellPrice":52.16,"profit":25.25,"multi":1.94,"saleDate":"07/11/2025","receiveDate":"01/12/2025","createdAt":"2025-11-07T00:00:00.000Z"},{"id":"s0793","productId":"831","buyPrice":15.0,"sellPrice":44.84,"profit":29.84,"multi":2.99,"saleDate":"08/11/2025","receiveDate":"01/12/2025","createdAt":"2025-11-08T00:00:00.000Z"},{"id":"s0794","productId":"912","buyPrice":24.98,"sellPrice":50.48,"profit":25.5,"multi":2.02,"saleDate":"08/11/2025","receiveDate":"01/12/2025","createdAt":"2025-11-08T00:00:00.000Z"},{"id":"s0795","productId":"176","buyPrice":17.27,"sellPrice":37.63,"profit":20.36,"multi":2.18,"saleDate":"10/11/2025","receiveDate":"01/12/2025","createdAt":"2025-11-10T00:00:00.000Z"},{"id":"s0796","productId":"865","buyPrice":20.0,"sellPrice":45.55,"profit":25.55,"multi":2.28,"saleDate":"08/11/2025","receiveDate":"01/12/2025","createdAt":"2025-11-08T00:00:00.000Z"},{"id":"s0797","productId":"808 et 812","buyPrice":50.0,"sellPrice":93.75,"profit":43.75,"multi":1.88,"saleDate":"10/11/2025","receiveDate":"01/12/2025","createdAt":"2025-11-10T00:00:00.000Z"},{"id":"s0798","productId":"614","buyPrice":15.88,"sellPrice":40.63,"profit":24.75,"multi":2.56,"saleDate":"10/11/2025","receiveDate":"02/12/2025","createdAt":"2025-11-10T00:00:00.000Z"},{"id":"s0799","productId":"828","buyPrice":21.57,"sellPrice":45.55,"profit":23.98,"multi":2.11,"saleDate":"15/11/2025","receiveDate":"02/12/2025","createdAt":"2025-11-15T00:00:00.000Z"},{"id":"s0800","productId":"939","buyPrice":22.0,"sellPrice":43.03,"profit":21.03,"multi":1.96,"saleDate":"12/11/2025","receiveDate":"02/12/2025","createdAt":"2025-11-12T00:00:00.000Z"},{"id":"s0801","productId":"917","buyPrice":26.81,"sellPrice":95.0,"profit":68.19,"multi":3.54,"saleDate":"11/11/2025","receiveDate":"02/12/2025","createdAt":"2025-11-11T00:00:00.000Z"},{"id":"s0802","productId":"817","buyPrice":24.0,"sellPrice":40.55,"profit":16.55,"multi":1.69,"saleDate":"10/11/2025","receiveDate":"02/12/2025","createdAt":"2025-11-10T00:00:00.000Z"},{"id":"s0803","productId":"880","buyPrice":20.24,"sellPrice":45.55,"profit":25.31,"multi":2.25,"saleDate":"09/11/2025","receiveDate":"02/12/2025","createdAt":"2025-11-09T00:00:00.000Z"},{"id":"s0804","productId":"358","buyPrice":29.31,"sellPrice":41.13,"profit":11.82,"multi":1.4,"saleDate":"06/11/2025","receiveDate":"02/12/2025","createdAt":"2025-11-06T00:00:00.000Z"},{"id":"s0805","productId":"18","buyPrice":17.49,"sellPrice":25.55,"profit":8.06,"multi":1.46,"saleDate":"15/11/2025","receiveDate":"03/12/2025","createdAt":"2025-11-15T00:00:00.000Z"},{"id":"s0806","productId":"616","buyPrice":31.01,"sellPrice":55.55,"profit":24.54,"multi":1.79,"saleDate":"05/11/2025","receiveDate":"03/12/2025","createdAt":"2025-11-05T00:00:00.000Z"},{"id":"s0807","productId":"833","buyPrice":24.7,"sellPrice":45.63,"profit":20.93,"multi":1.85,"saleDate":"15/11/2025","receiveDate":"03/12/2025","createdAt":"2025-11-15T00:00:00.000Z"},{"id":"s0808","productId":"926","buyPrice":26.21,"sellPrice":50.48,"profit":24.27,"multi":1.93,"saleDate":"10/11/2025","receiveDate":"04/12/2025","createdAt":"2025-11-10T00:00:00.000Z"},{"id":"s0809","productId":"464","buyPrice":12.44,"sellPrice":48.67,"profit":36.23,"multi":3.91,"saleDate":"16/11/2025","receiveDate":"04/12/2025","createdAt":"2025-11-16T00:00:00.000Z"},{"id":"s0810","productId":"123","buyPrice":13.24,"sellPrice":44.64,"profit":31.4,"multi":3.37,"saleDate":"11/11/2025","receiveDate":"04/12/2025","createdAt":"2025-11-11T00:00:00.000Z"},{"id":"s0811","productId":"266","buyPrice":19.54,"sellPrice":35.71,"profit":16.17,"multi":1.83,"saleDate":"10/11/2025","receiveDate":"04/12/2025","createdAt":"2025-11-10T00:00:00.000Z"},{"id":"s0812","productId":"693","buyPrice":24.7,"sellPrice":54.65,"profit":29.95,"multi":2.21,"saleDate":"02/11/2025","receiveDate":"04/12/2025","createdAt":"2025-11-02T00:00:00.000Z"},{"id":"s0813","productId":"924","buyPrice":26.81,"sellPrice":50.48,"profit":23.67,"multi":1.88,"saleDate":"11/11/2025","receiveDate":"04/12/2025","createdAt":"2025-11-11T00:00:00.000Z"},{"id":"s0814","productId":"602","buyPrice":56.45,"sellPrice":35.71,"profit":-20.74,"multi":0.63,"saleDate":"14/11/2025","receiveDate":"05/12/2025","createdAt":"2025-11-14T00:00:00.000Z"},{"id":"s0815","productId":"232","buyPrice":21.04,"sellPrice":30.71,"profit":9.67,"multi":1.46,"saleDate":"15/11/2025","receiveDate":"05/12/2025","createdAt":"2025-11-15T00:00:00.000Z"},{"id":"s0816","productId":"916","buyPrice":30.51,"sellPrice":87.71,"profit":57.2,"multi":2.87,"saleDate":"11/11/2025","receiveDate":"05/12/2025","createdAt":"2025-11-11T00:00:00.000Z"},{"id":"s0817","productId":"586","buyPrice":19.73,"sellPrice":37.23,"profit":17.5,"multi":1.89,"saleDate":"31/10/2025","receiveDate":"05/12/2025","createdAt":"2025-10-31T00:00:00.000Z"},{"id":"s0818","productId":"618","buyPrice":19.09,"sellPrice":45.77,"profit":26.68,"multi":2.4,"saleDate":"16/11/2025","receiveDate":"05/12/2025","createdAt":"2025-11-16T00:00:00.000Z"},{"id":"s0819","productId":"589","buyPrice":8.1,"sellPrice":18.55,"profit":10.45,"multi":2.29,"saleDate":"13/11/2025","receiveDate":"05/12/2025","createdAt":"2025-11-13T00:00:00.000Z"},{"id":"s0820","productId":"815","buyPrice":25.0,"sellPrice":40.55,"profit":15.55,"multi":1.62,"saleDate":"10/11/2025","receiveDate":"05/12/2025","createdAt":"2025-11-10T00:00:00.000Z"},{"id":"s0821","productId":"925","buyPrice":25.2,"sellPrice":50.48,"profit":25.28,"multi":2.0,"saleDate":"12/11/2025","receiveDate":"08/12/2025","createdAt":"2025-11-12T00:00:00.000Z"},{"id":"s0822","productId":"69","buyPrice":13.31,"sellPrice":20.63,"profit":7.32,"multi":1.55,"saleDate":"13/11/2025","receiveDate":"08/12/2025","createdAt":"2025-11-13T00:00:00.000Z"},{"id":"s0823","productId":"256","buyPrice":24.895,"sellPrice":44.58,"profit":19.68,"multi":1.79,"saleDate":"16/11/2025","receiveDate":"08/12/2025","createdAt":"2025-11-16T00:00:00.000Z"},{"id":"s0824","productId":"465","buyPrice":14.09,"sellPrice":30.48,"profit":16.39,"multi":2.16,"saleDate":"17/11/2025","receiveDate":"08/12/2025","createdAt":"2025-11-17T00:00:00.000Z"},{"id":"s0825","productId":"943","buyPrice":53.32,"sellPrice":72.85,"profit":19.53,"multi":1.37,"saleDate":"16/11/2025","receiveDate":"08/12/2025","createdAt":"2025-11-16T00:00:00.000Z"},{"id":"s0826","productId":"678","buyPrice":14.89,"sellPrice":45.55,"profit":30.66,"multi":3.06,"saleDate":"13/11/2025","receiveDate":"08/12/2025","createdAt":"2025-11-13T00:00:00.000Z"},{"id":"s0827","productId":"182","buyPrice":28.53,"sellPrice":35.48,"profit":6.95,"multi":1.24,"saleDate":"11/11/2025","receiveDate":"08/12/2025","createdAt":"2025-11-11T00:00:00.000Z"},{"id":"s0828","productId":"813","buyPrice":25.0,"sellPrice":44.55,"profit":19.55,"multi":1.78,"saleDate":"15/11/2025","receiveDate":"08/12/2025","createdAt":"2025-11-15T00:00:00.000Z"},{"id":"s0829","productId":"759","buyPrice":25.0,"sellPrice":38.32,"profit":13.32,"multi":1.53,"saleDate":"12/11/2025","receiveDate":"09/12/2025","createdAt":"2025-11-12T00:00:00.000Z"},{"id":"s0830","productId":"483","buyPrice":9.57,"sellPrice":43.54,"profit":33.97,"multi":4.55,"saleDate":"17/11/2025","receiveDate":"09/12/2025","createdAt":"2025-11-17T00:00:00.000Z"},{"id":"s0831","productId":"754","buyPrice":25.0,"sellPrice":47.54,"profit":22.54,"multi":1.9,"saleDate":"20/10/2025","receiveDate":"09/12/2025","createdAt":"2025-10-20T00:00:00.000Z"},{"id":"s0832","productId":"745","buyPrice":10.72,"sellPrice":35.71,"profit":24.99,"multi":3.33,"saleDate":"11/11/2025","receiveDate":"09/12/2025","createdAt":"2025-11-11T00:00:00.000Z"},{"id":"s0833","productId":"443","buyPrice":20.24,"sellPrice":47.63,"profit":27.39,"multi":2.35,"saleDate":"17/11/2025","receiveDate":"10/12/2025","createdAt":"2025-11-17T00:00:00.000Z"},{"id":"s0834","productId":"54","buyPrice":20.24,"sellPrice":38.95,"profit":18.71,"multi":1.92,"saleDate":"16/11/2025","receiveDate":"10/12/2025","createdAt":"2025-11-16T00:00:00.000Z"},{"id":"s0835","productId":"878","buyPrice":25.59,"sellPrice":52.55,"profit":26.96,"multi":2.05,"saleDate":"21/11/2025","receiveDate":"10/12/2025","createdAt":"2025-11-21T00:00:00.000Z"},{"id":"s0836","productId":"478","buyPrice":26.09,"sellPrice":89.63,"profit":63.54,"multi":3.44,"saleDate":"21/11/2025","receiveDate":"10/12/2025","createdAt":"2025-11-21T00:00:00.000Z"},{"id":"s0837","productId":"628","buyPrice":25.21,"sellPrice":43.71,"profit":18.5,"multi":1.73,"saleDate":"15/11/2025","receiveDate":"11/12/2025","createdAt":"2025-11-15T00:00:00.000Z"},{"id":"s0838","productId":"787","buyPrice":25.0,"sellPrice":40.53,"profit":15.53,"multi":1.62,"saleDate":"23/11/2025","receiveDate":"11/12/2025","createdAt":"2025-11-23T00:00:00.000Z"},{"id":"s0839","productId":"435","buyPrice":12.01,"sellPrice":41.23,"profit":29.22,"multi":3.43,"saleDate":"20/11/2025","receiveDate":"11/12/2025","createdAt":"2025-11-20T00:00:00.000Z"},{"id":"s0840","productId":"240","buyPrice":11.67,"sellPrice":40.98,"profit":29.31,"multi":3.51,"saleDate":"21/11/2025","receiveDate":"11/12/2025","createdAt":"2025-11-21T00:00:00.000Z"},{"id":"s0841","productId":"45","buyPrice":14.28,"sellPrice":42.13,"profit":27.85,"multi":2.95,"saleDate":"22/11/2025","receiveDate":"11/12/2025","createdAt":"2025-11-22T00:00:00.000Z"},{"id":"s0842","productId":"901","buyPrice":19.3,"sellPrice":45.54,"profit":26.24,"multi":2.36,"saleDate":"21/11/2025","receiveDate":"12/12/2025","createdAt":"2025-11-21T00:00:00.000Z"},{"id":"s0843","productId":"61","buyPrice":14.79,"sellPrice":21.83,"profit":7.04,"multi":1.48,"saleDate":"20/11/2025","receiveDate":"12/12/2025","createdAt":"2025-11-20T00:00:00.000Z"},{"id":"s0844","productId":"718","buyPrice":24.7,"sellPrice":49.48,"profit":24.78,"multi":2.0,"saleDate":"18/11/2025","receiveDate":"15/12/2025","createdAt":"2025-11-18T00:00:00.000Z"},{"id":"s0845","productId":"847","buyPrice":1.0,"sellPrice":22.33,"profit":21.33,"multi":22.33,"saleDate":"23/11/2025","receiveDate":"15/12/2025","createdAt":"2025-11-23T00:00:00.000Z"},{"id":"s0846","productId":"964","buyPrice":14.28,"sellPrice":30.5,"profit":16.22,"multi":2.14,"saleDate":"26/11/2025","receiveDate":"15/12/2025","createdAt":"2025-11-26T00:00:00.000Z"},{"id":"s0847","productId":"951","buyPrice":26.81,"sellPrice":65.48,"profit":38.67,"multi":2.44,"saleDate":"23/11/2025","receiveDate":"15/12/2025","createdAt":"2025-11-23T00:00:00.000Z"},{"id":"s0848","productId":"950","buyPrice":26.81,"sellPrice":53.13,"profit":26.32,"multi":1.98,"saleDate":"23/11/2025","receiveDate":"15/12/2025","createdAt":"2025-11-23T00:00:00.000Z"},{"id":"s0849","productId":"958","buyPrice":24.12,"sellPrice":40.48,"profit":16.36,"multi":1.68,"saleDate":"25/11/2025","receiveDate":"15/12/2025","createdAt":"2025-11-25T00:00:00.000Z"},{"id":"s0850","productId":"954 et 622","buyPrice":26.0,"sellPrice":63.23,"profit":37.23,"multi":2.43,"saleDate":"25/11/2025","receiveDate":"15/12/2025","createdAt":"2025-11-25T00:00:00.000Z"},{"id":"s0851","productId":"922","buyPrice":22.61,"sellPrice":44.9,"profit":22.29,"multi":1.99,"saleDate":"26/11/2025","receiveDate":"15/12/2025","createdAt":"2025-11-26T00:00:00.000Z"},{"id":"s0852","productId":"793","buyPrice":25.0,"sellPrice":40.1,"profit":15.1,"multi":1.6,"saleDate":"25/11/2025","receiveDate":"16/12/2025","createdAt":"2025-11-25T00:00:00.000Z"},{"id":"s0853","productId":"530","buyPrice":14.69,"sellPrice":40.82,"profit":26.13,"multi":2.78,"saleDate":"26/11/2025","receiveDate":"16/12/2025","createdAt":"2025-11-26T00:00:00.000Z"},{"id":"s0854","productId":"513","buyPrice":11.15,"sellPrice":22.88,"profit":11.73,"multi":2.05,"saleDate":"25/11/2025","receiveDate":"16/12/2025","createdAt":"2025-11-25T00:00:00.000Z"},{"id":"s0855","productId":"707","buyPrice":26.81,"sellPrice":58.35,"profit":31.54,"multi":2.18,"saleDate":"19/11/2025","receiveDate":"17/12/2025","createdAt":"2025-11-19T00:00:00.000Z"},{"id":"s0856","productId":"135","buyPrice":14.28,"sellPrice":32.48,"profit":18.2,"multi":2.27,"saleDate":"24/11/2025","receiveDate":"17/12/2025","createdAt":"2025-11-24T00:00:00.000Z"},{"id":"s0857","productId":"824","buyPrice":25.2,"sellPrice":44.77,"profit":19.57,"multi":1.78,"saleDate":"22/11/2025","receiveDate":"17/12/2025","createdAt":"2025-11-22T00:00:00.000Z"},{"id":"s0858","productId":"780","buyPrice":20.4,"sellPrice":40.77,"profit":20.37,"multi":2.0,"saleDate":"30/11/2025","receiveDate":"18/12/2025","createdAt":"2025-11-30T00:00:00.000Z"},{"id":"s0859","productId":"985","buyPrice":24.7,"sellPrice":40.8,"profit":16.1,"multi":1.65,"saleDate":"29/11/2025","receiveDate":"18/12/2025","createdAt":"2025-11-29T00:00:00.000Z"},{"id":"s0860","productId":"31","buyPrice":14.19,"sellPrice":28.63,"profit":14.44,"multi":2.02,"saleDate":"27/12/2025","receiveDate":"19/12/2025","createdAt":"2025-12-27T00:00:00.000Z"},{"id":"s0861","productId":"966","buyPrice":30.51,"sellPrice":38.48,"profit":7.97,"multi":1.26,"saleDate":"29/11/2025","receiveDate":"19/12/2025","createdAt":"2025-11-29T00:00:00.000Z"},{"id":"s0862","productId":"949","buyPrice":26.81,"sellPrice":60.71,"profit":33.9,"multi":2.26,"saleDate":"23/11/2025","receiveDate":"19/12/2025","createdAt":"2025-11-23T00:00:00.000Z"},{"id":"s0863","productId":"802","buyPrice":25.0,"sellPrice":47.77,"profit":22.77,"multi":1.91,"saleDate":"29/11/2025","receiveDate":"19/12/2025","createdAt":"2025-11-29T00:00:00.000Z"},{"id":"s0864","productId":"993","buyPrice":15.0,"sellPrice":40.77,"profit":25.77,"multi":2.72,"saleDate":"30/11/2025","receiveDate":"19/12/2025","createdAt":"2025-11-30T00:00:00.000Z"},{"id":"s0865","productId":"979","buyPrice":20.56,"sellPrice":45.5,"profit":24.94,"multi":2.21,"saleDate":"29/11/2025","receiveDate":"19/12/2025","createdAt":"2025-11-29T00:00:00.000Z"},{"id":"s0866","productId":"858","buyPrice":10.45,"sellPrice":34.01,"profit":23.56,"multi":3.25,"saleDate":"24/11/2025","receiveDate":"19/12/2025","createdAt":"2025-11-24T00:00:00.000Z"},{"id":"s0867","productId":"929","buyPrice":26.81,"sellPrice":65.5,"profit":38.69,"multi":2.44,"saleDate":"29/11/2025","receiveDate":"22/12/2025","createdAt":"2025-11-29T00:00:00.000Z"},{"id":"s0868","productId":"944","buyPrice":22.68,"sellPrice":50.5,"profit":27.82,"multi":2.23,"saleDate":"23/11/2025","receiveDate":"22/12/2025","createdAt":"2025-11-23T00:00:00.000Z"},{"id":"s0869","productId":"517","buyPrice":7.19,"sellPrice":30.71,"profit":23.52,"multi":4.27,"saleDate":"22/11/2025","receiveDate":"22/12/2025","createdAt":"2025-11-22T00:00:00.000Z"},{"id":"s0870","productId":"961","buyPrice":15.79,"sellPrice":44.6,"profit":28.81,"multi":2.82,"saleDate":"01/12/2025","receiveDate":"22/12/2025","createdAt":"2025-12-01T00:00:00.000Z"},{"id":"s0871","productId":"21","buyPrice":33.06,"sellPrice":68.0,"profit":34.94,"multi":2.06,"saleDate":"27/11/2025","receiveDate":"22/12/2025","createdAt":"2025-11-27T00:00:00.000Z"},{"id":"s0872","productId":"661","buyPrice":20.53,"sellPrice":55.35,"profit":34.82,"multi":2.7,"saleDate":"30/11/2025","receiveDate":"22/12/2025","createdAt":"2025-11-30T00:00:00.000Z"},{"id":"s0873","productId":"750","buyPrice":22.0,"sellPrice":47.85,"profit":25.85,"multi":2.18,"saleDate":"01/12/2025","receiveDate":"22/12/2025","createdAt":"2025-12-01T00:00:00.000Z"},{"id":"s0874","productId":"942","buyPrice":26.81,"sellPrice":65.71,"profit":38.9,"multi":2.45,"saleDate":"29/11/2025","receiveDate":"23/12/2025","createdAt":"2025-11-29T00:00:00.000Z"},{"id":"s0875","productId":"532","buyPrice":20.24,"sellPrice":35.0,"profit":14.76,"multi":1.73,"saleDate":"30/11/2025","receiveDate":"23/12/2025","createdAt":"2025-11-30T00:00:00.000Z"},{"id":"s0876","productId":"983","buyPrice":24.58,"sellPrice":54.63,"profit":30.05,"multi":2.22,"saleDate":"30/11/2025","receiveDate":"26/12/2025","createdAt":"2025-11-30T00:00:00.000Z"},{"id":"s0877","productId":"862","buyPrice":8.6,"sellPrice":18.63,"profit":10.03,"multi":2.17,"saleDate":"01/12/2025","receiveDate":"26/12/2025","createdAt":"2025-12-01T00:00:00.000Z"},{"id":"s0878","productId":"955","buyPrice":26.81,"sellPrice":70.48,"profit":43.67,"multi":2.63,"saleDate":"10/12/2025","receiveDate":"26/12/2025","createdAt":"2025-12-10T00:00:00.000Z"},{"id":"s0879","productId":"996","buyPrice":19.3,"sellPrice":54.5,"profit":35.2,"multi":2.82,"saleDate":"08/12/2025","receiveDate":"29/12/2025","createdAt":"2025-12-08T00:00:00.000Z"},{"id":"s0880","productId":"928","buyPrice":26.81,"sellPrice":70.5,"profit":43.69,"multi":2.63,"saleDate":"08/12/2025","receiveDate":"29/12/2025","createdAt":"2025-12-08T00:00:00.000Z"},{"id":"s0881","productId":"973","buyPrice":24.7,"sellPrice":45.53,"profit":20.83,"multi":1.84,"saleDate":"30/11/2025","receiveDate":"29/12/2025","createdAt":"2025-11-30T00:00:00.000Z"},{"id":"s0882","productId":"997","buyPrice":17.19,"sellPrice":51.78,"profit":34.59,"multi":3.01,"saleDate":"08/12/2025","receiveDate":"29/12/2025","createdAt":"2025-12-08T00:00:00.000Z"},{"id":"s0883","productId":"959","buyPrice":26.81,"sellPrice":62.53,"profit":35.72,"multi":2.33,"saleDate":"30/11/2025","receiveDate":"29/12/2025","createdAt":"2025-11-30T00:00:00.000Z"},{"id":"s0884","productId":"967","buyPrice":16.87,"sellPrice":45.5,"profit":28.63,"multi":2.7,"saleDate":"08/12/2025","receiveDate":"29/12/2025","createdAt":"2025-12-08T00:00:00.000Z"},{"id":"s0885","productId":"931","buyPrice":26.81,"sellPrice":74.75,"profit":47.94,"multi":2.79,"saleDate":"07/12/2025","receiveDate":"30/12/2025","createdAt":"2025-12-07T00:00:00.000Z"},{"id":"s0886","productId":"1003","buyPrice":24.18,"sellPrice":44.48,"profit":20.3,"multi":1.84,"saleDate":"11/12/2025","receiveDate":"30/12/2025","createdAt":"2025-12-11T00:00:00.000Z"},{"id":"s0887","productId":"999","buyPrice":24.51,"sellPrice":49.48,"profit":24.97,"multi":2.02,"saleDate":"09/12/2025","receiveDate":"30/12/2025","createdAt":"2025-12-09T00:00:00.000Z"},{"id":"s0888","productId":"1009","buyPrice":25.0,"sellPrice":52.78,"profit":27.78,"multi":2.11,"saleDate":"13/12/2025","receiveDate":"02/01/2026","createdAt":"2025-12-13T00:00:00.000Z"},{"id":"s0889","productId":"918","buyPrice":26.81,"sellPrice":75.85,"profit":49.04,"multi":2.83,"saleDate":"10/12/2025","receiveDate":"02/01/2026","createdAt":"2025-12-10T00:00:00.000Z"},{"id":"s0890","productId":"1021","buyPrice":22.0,"sellPrice":55.67,"profit":33.67,"multi":2.53,"saleDate":"13/12/2025","receiveDate":"02/01/2026","createdAt":"2025-12-13T00:00:00.000Z"},{"id":"s0891","productId":"1012","buyPrice":24.7,"sellPrice":55.5,"profit":30.8,"multi":2.25,"saleDate":"14/12/2025","receiveDate":"02/01/2026","createdAt":"2025-12-14T00:00:00.000Z"},{"id":"s0892","productId":"930","buyPrice":26.81,"sellPrice":65.5,"profit":38.69,"multi":2.44,"saleDate":"09/12/2025","receiveDate":"02/01/2026","createdAt":"2025-12-09T00:00:00.000Z"},{"id":"s0893","productId":"994","buyPrice":26.81,"sellPrice":67.31,"profit":40.5,"multi":2.51,"saleDate":"11/12/2025","receiveDate":"02/01/2026","createdAt":"2025-12-11T00:00:00.000Z"},{"id":"s0894","productId":"982","buyPrice":24.79,"sellPrice":54.48,"profit":29.69,"multi":2.2,"saleDate":"15/12/2025","receiveDate":"02/01/2026","createdAt":"2025-12-15T00:00:00.000Z"},{"id":"s0895","productId":"59","buyPrice":29.71,"sellPrice":35.48,"profit":5.77,"multi":1.19,"saleDate":"13/12/2025","receiveDate":"02/01/2026","createdAt":"2025-12-13T00:00:00.000Z"},{"id":"s0896","productId":"1015","buyPrice":16.97,"sellPrice":45.48,"profit":28.51,"multi":2.68,"saleDate":"13/12/2025","receiveDate":"02/01/2025","createdAt":"2025-12-13T00:00:00.000Z"},{"id":"s0897","productId":"947","buyPrice":26.81,"sellPrice":58.71,"profit":31.9,"multi":2.19,"saleDate":"13/12/2025","receiveDate":"02/01/2026","createdAt":"2025-12-13T00:00:00.000Z"},{"id":"s0898","productId":"1008","buyPrice":24.5,"sellPrice":45.54,"profit":21.04,"multi":1.86,"saleDate":"13/12/2025","receiveDate":"05/01/2026","createdAt":"2025-12-13T00:00:00.000Z"},{"id":"s0899","productId":"984","buyPrice":21.91,"sellPrice":50.48,"profit":28.57,"multi":2.3,"saleDate":"16/12/2025","receiveDate":"05/01/2026","createdAt":"2025-12-16T00:00:00.000Z"},{"id":"s0900","productId":"843","buyPrice":21.24,"sellPrice":45.75,"profit":24.51,"multi":2.15,"saleDate":"13/12/2025","receiveDate":"05/01/2026","createdAt":"2025-12-13T00:00:00.000Z"},{"id":"s0901","productId":"1017","buyPrice":22.0,"sellPrice":45.5,"profit":23.5,"multi":2.07,"saleDate":"17/12/2025","receiveDate":"05/01/2026","createdAt":"2025-12-17T00:00:00.000Z"},{"id":"s0902","productId":"965","buyPrice":21.6,"sellPrice":50.5,"profit":28.9,"multi":2.34,"saleDate":"15/12/2025","receiveDate":"05/01/2026","createdAt":"2025-12-15T00:00:00.000Z"},{"id":"s0903","productId":"1022","buyPrice":22.0,"sellPrice":45.48,"profit":23.48,"multi":2.07,"saleDate":"14/12/2025","receiveDate":"05/01/2026","createdAt":"2025-12-14T00:00:00.000Z"},{"id":"s0904","productId":"932+1020","buyPrice":53.73,"sellPrice":101.2,"profit":47.47,"multi":1.88,"saleDate":"14/12/2025","receiveDate":"06/01/2026","createdAt":"2025-12-14T00:00:00.000Z"},{"id":"s0905","productId":"995","buyPrice":26.81,"sellPrice":60.48,"profit":33.67,"multi":2.26,"saleDate":"20/12/2025","receiveDate":"06/01/2026","createdAt":"2025-12-20T00:00:00.000Z"},{"id":"s0906","productId":"1018","buyPrice":26.81,"sellPrice":50.21,"profit":23.4,"multi":1.87,"saleDate":"13/12/2025","receiveDate":"06/01/2026","createdAt":"2025-12-13T00:00:00.000Z"},{"id":"s0907","productId":"1007","buyPrice":25.0,"sellPrice":45.85,"profit":20.85,"multi":1.83,"saleDate":"15/12/2025","receiveDate":"06/01/2026","createdAt":"2025-12-15T00:00:00.000Z"},{"id":"s0908","productId":"933","buyPrice":26.81,"sellPrice":65.48,"profit":38.67,"multi":2.44,"saleDate":"08/12/2025","receiveDate":"07/01/2026","createdAt":"2025-12-08T00:00:00.000Z"},{"id":"s0909","productId":"339","buyPrice":1.0,"sellPrice":14.73,"profit":13.73,"multi":14.73,"saleDate":"13/12/2025","receiveDate":"07/01/2026","createdAt":"2025-12-13T00:00:00.000Z"},{"id":"s0910","productId":"936","buyPrice":26.81,"sellPrice":61.2,"profit":34.39,"multi":2.28,"saleDate":"12/12/2025","receiveDate":"07/01/2026","createdAt":"2025-12-12T00:00:00.000Z"},{"id":"s0911","productId":"1023","buyPrice":23.72,"sellPrice":50.88,"profit":27.16,"multi":2.15,"saleDate":"16/12/2025","receiveDate":"07/01/2026","createdAt":"2025-12-16T00:00:00.000Z"},{"id":"s0912","productId":"329","buyPrice":15.32,"sellPrice":25.82,"profit":10.5,"multi":1.69,"saleDate":"12/12/2025","receiveDate":"07/01/2026","createdAt":"2025-12-12T00:00:00.000Z"},{"id":"s0913","productId":"1006","buyPrice":20.6,"sellPrice":50.5,"profit":29.9,"multi":2.45,"saleDate":"15/12/2025","receiveDate":"07/01/2026","createdAt":"2025-12-15T00:00:00.000Z"},{"id":"s0914","productId":"971","buyPrice":19.3,"sellPrice":43.7,"profit":24.4,"multi":2.26,"saleDate":"20/12/2025","receiveDate":"09/01/2026","createdAt":"2025-12-20T00:00:00.000Z"},{"id":"s0915","productId":"47","buyPrice":21.0,"sellPrice":32.48,"profit":11.48,"multi":1.55,"saleDate":"30/12/2025","receiveDate":"10/01/2026","createdAt":"2025-12-30T00:00:00.000Z"},{"id":"s0916","productId":"935","buyPrice":26.81,"sellPrice":52.73,"profit":25.92,"multi":1.97,"saleDate":"21/12/2025","receiveDate":"12/01/2026","createdAt":"2025-12-21T00:00:00.000Z"},{"id":"s0917","productId":"837","buyPrice":14.89,"sellPrice":35.63,"profit":20.74,"multi":2.39,"saleDate":"18/12/2025","receiveDate":"12/01/2026","createdAt":"2025-12-18T00:00:00.000Z"},{"id":"s0918","productId":"986","buyPrice":21.6,"sellPrice":46.48,"profit":24.88,"multi":2.15,"saleDate":"22/12/2025","receiveDate":"12/01/2026","createdAt":"2025-12-22T00:00:00.000Z"},{"id":"s0919","productId":"911","buyPrice":25.81,"sellPrice":53.77,"profit":27.96,"multi":2.08,"saleDate":"28/12/2025","receiveDate":"13/01/2026","createdAt":"2025-12-28T00:00:00.000Z"},{"id":"s0920","productId":"968","buyPrice":24.51,"sellPrice":45.71,"profit":21.2,"multi":1.86,"saleDate":"22/12/2025","receiveDate":"13/01/2026","createdAt":"2025-12-22T00:00:00.000Z"},{"id":"s0921","productId":"1046","buyPrice":22.0,"sellPrice":40.48,"profit":18.48,"multi":1.84,"saleDate":"23/12/2025","receiveDate":"13/01/2026","createdAt":"2025-12-23T00:00:00.000Z"},{"id":"s0922","productId":"948","buyPrice":26.81,"sellPrice":50.5,"profit":23.69,"multi":1.88,"saleDate":"26/12/2025","receiveDate":"14/01/2026","createdAt":"2025-12-26T00:00:00.000Z"},{"id":"s0923","productId":"1055","buyPrice":24.7,"sellPrice":55.5,"profit":30.8,"multi":2.25,"saleDate":"25/12/2025","receiveDate":"14/01/2026","createdAt":"2025-12-25T00:00:00.000Z"},{"id":"s0924","productId":"625","buyPrice":34.71,"sellPrice":82.48,"profit":47.77,"multi":2.38,"saleDate":"25/12/2025","receiveDate":"14/01/2026","createdAt":"2025-12-25T00:00:00.000Z"},{"id":"s0925","productId":"1002","buyPrice":25.31,"sellPrice":40.85,"profit":15.54,"multi":1.61,"saleDate":"22/12/2025","receiveDate":"14/01/2026","createdAt":"2025-12-22T00:00:00.000Z"},{"id":"s0926","productId":"864","buyPrice":24.7,"sellPrice":40.71,"profit":16.01,"multi":1.65,"saleDate":"24/12/2025","receiveDate":"14/01/2026","createdAt":"2025-12-24T00:00:00.000Z"},{"id":"s0927","productId":"741","buyPrice":19.49,"sellPrice":29.5,"profit":10.01,"multi":1.51,"saleDate":"26/12/2025","receiveDate":"14/01/2026","createdAt":"2025-12-26T00:00:00.000Z"},{"id":"s0928","productId":"870","buyPrice":25.34,"sellPrice":39.5,"profit":14.16,"multi":1.56,"saleDate":"26/12/2025","receiveDate":"14/01/2026","createdAt":"2025-12-26T00:00:00.000Z"},{"id":"s0929","productId":"1014","buyPrice":20.0,"sellPrice":42.71,"profit":22.71,"multi":2.14,"saleDate":"23/12/2025","receiveDate":"16/01/2026","createdAt":"2025-12-23T00:00:00.000Z"},{"id":"s0930","productId":"739","buyPrice":24.0,"sellPrice":42.5,"profit":18.5,"multi":1.77,"saleDate":"29/11/2025","receiveDate":"16/01/2026","createdAt":"2025-11-29T00:00:00.000Z"},{"id":"s0931","productId":"614","buyPrice":15.88,"sellPrice":18.71,"profit":2.83,"multi":1.18,"saleDate":"23/12/2025","receiveDate":"16/01/2026","createdAt":"2025-12-23T00:00:00.000Z"},{"id":"s0932","productId":"541","buyPrice":11.9,"sellPrice":29.63,"profit":17.73,"multi":2.49,"saleDate":"26/12/2025","receiveDate":"16/01/2026","createdAt":"2025-12-26T00:00:00.000Z"},{"id":"s0933","productId":"1054","buyPrice":24.04,"sellPrice":47.5,"profit":23.46,"multi":1.98,"saleDate":"29/12/2025","receiveDate":"16/01/2026","createdAt":"2025-12-29T00:00:00.000Z"},{"id":"s0934","productId":"1062","buyPrice":24.3,"sellPrice":54.5,"profit":30.2,"multi":2.24,"saleDate":"29/12/2025","receiveDate":"16/01/2026","createdAt":"2025-12-29T00:00:00.000Z"},{"id":"s0935","productId":"435","buyPrice":12.01,"sellPrice":50.67,"profit":38.66,"multi":4.22,"saleDate":"29/12/2025","receiveDate":"19/01/2026","createdAt":"2025-12-29T00:00:00.000Z"},{"id":"s0936","productId":"920","buyPrice":26.81,"sellPrice":69.5,"profit":42.69,"multi":2.59,"saleDate":"30/12/2025","receiveDate":"19/01/2026","createdAt":"2025-12-30T00:00:00.000Z"},{"id":"s0937","productId":"774","buyPrice":25.0,"sellPrice":42.5,"profit":17.5,"multi":1.7,"saleDate":"29/12/2025","receiveDate":"19/01/2026","createdAt":"2025-12-29T00:00:00.000Z"},{"id":"s0938","productId":"554","buyPrice":11.02,"sellPrice":20.53,"profit":9.51,"multi":1.86,"saleDate":"25/12/2025","receiveDate":"19/01/2026","createdAt":"2025-12-25T00:00:00.000Z"},{"id":"s0939","productId":"25","buyPrice":27.39,"sellPrice":35.5,"profit":8.11,"multi":1.3,"saleDate":"29/12/2025","receiveDate":"19/01/2026","createdAt":"2025-12-29T00:00:00.000Z"},{"id":"s0940","productId":"1031","buyPrice":20.6,"sellPrice":45.5,"profit":24.9,"multi":2.21,"saleDate":"28/12/2025","receiveDate":"19/01/2026","createdAt":"2025-12-28T00:00:00.000Z"},{"id":"s0941","productId":"1000","buyPrice":22.61,"sellPrice":42.5,"profit":19.89,"multi":1.88,"saleDate":"29/12/2025","receiveDate":"19/01/2026","createdAt":"2025-12-29T00:00:00.000Z"},{"id":"s0942","productId":"860","buyPrice":31.41,"sellPrice":49.71,"profit":18.3,"multi":1.58,"saleDate":"27/12/2025","receiveDate":"19/01/2026","createdAt":"2025-12-27T00:00:00.000Z"},{"id":"s0943","productId":"1059","buyPrice":34.0,"sellPrice":45.5,"profit":11.5,"multi":1.34,"saleDate":"29/12/2025","receiveDate":"19/01/2026","createdAt":"2025-12-29T00:00:00.000Z"},{"id":"s0944","productId":"654 et 525","buyPrice":33.0,"sellPrice":50.63,"profit":17.63,"multi":1.53,"saleDate":"30/12/2025","receiveDate":"20/01/2026","createdAt":"2025-12-30T00:00:00.000Z"},{"id":"s0945","productId":"1053","buyPrice":20.0,"sellPrice":30.85,"profit":10.85,"multi":1.54,"saleDate":"30/12/2025","receiveDate":"20/01/2026","createdAt":"2025-12-30T00:00:00.000Z"},{"id":"s0946","productId":"923","buyPrice":21.6,"sellPrice":48.23,"profit":26.63,"multi":2.23,"saleDate":"21/12/2025","receiveDate":"20/01/2026","createdAt":"2025-12-21T00:00:00.000Z"},{"id":"s0947","productId":"970","buyPrice":16.7,"sellPrice":40.48,"profit":23.78,"multi":2.42,"saleDate":"29/12/2025","receiveDate":"20/01/2026","createdAt":"2025-12-29T00:00:00.000Z"},{"id":"s0948","productId":"572","buyPrice":40.54,"sellPrice":64.71,"profit":24.17,"multi":1.6,"saleDate":"30/12/2025","receiveDate":"21/01/2026","createdAt":"2025-12-30T00:00:00.000Z"},{"id":"s0949","productId":"1052","buyPrice":14.0,"sellPrice":20.88,"profit":6.88,"multi":1.49,"saleDate":"30/12/2025","receiveDate":"22/01/2026","createdAt":"2025-12-30T00:00:00.000Z"},{"id":"s0950","productId":"844","buyPrice":10.45,"sellPrice":16.08,"profit":5.63,"multi":1.54,"saleDate":"27/12/2025","receiveDate":"22/01/2026","createdAt":"2025-12-27T00:00:00.000Z"},{"id":"s0951","productId":"644","buyPrice":20.84,"sellPrice":30.71,"profit":9.87,"multi":1.47,"saleDate":"30/12/2025","receiveDate":"22/01/2026","createdAt":"2025-12-30T00:00:00.000Z"},{"id":"s0952","productId":"Lot 3 paires","buyPrice":39.94,"sellPrice":124.4,"profit":84.46,"multi":3.11,"saleDate":"30/12/2025","receiveDate":"22/01/2026","createdAt":"2025-12-30T00:00:00.000Z"},{"id":"s0953","productId":"703","buyPrice":27.05,"sellPrice":38.48,"profit":11.43,"multi":1.42,"saleDate":"02/01/2026","receiveDate":"22/01/2026","createdAt":"2026-01-02T00:00:00.000Z"},{"id":"s0954","productId":"931","buyPrice":26.81,"sellPrice":55.48,"profit":28.67,"multi":2.07,"saleDate":"30/12/2025","receiveDate":"22/01/2026","createdAt":"2025-12-30T00:00:00.000Z"},{"id":"s0955","productId":"612","buyPrice":14.19,"sellPrice":30.54,"profit":16.35,"multi":2.15,"saleDate":"30/12/2025","receiveDate":"22/01/2026","createdAt":"2025-12-30T00:00:00.000Z"},{"id":"s0956","productId":"863","buyPrice":29.9,"sellPrice":64.73,"profit":34.83,"multi":2.16,"saleDate":"23/12/2025","receiveDate":"23/01/2026","createdAt":"2025-12-23T00:00:00.000Z"},{"id":"s0957","productId":"576","buyPrice":20.24,"sellPrice":35.71,"profit":15.47,"multi":1.76,"saleDate":"30/12/2025","receiveDate":"23/01/2026","createdAt":"2025-12-30T00:00:00.000Z"},{"id":"s0958","productId":"350","buyPrice":21.94,"sellPrice":29.67,"profit":7.73,"multi":1.35,"saleDate":"01/01/2026","receiveDate":"23/01/2026","createdAt":"2026-01-01T00:00:00.000Z"},{"id":"s0959","productId":"1083","buyPrice":11.0,"sellPrice":20.67,"profit":9.67,"multi":1.88,"saleDate":"01/01/2026","receiveDate":"23/01/2026","createdAt":"2026-01-01T00:00:00.000Z"},{"id":"s0960","productId":"988","buyPrice":24.51,"sellPrice":45.67,"profit":21.16,"multi":1.86,"saleDate":"04/01/2026","receiveDate":"23/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s0961","productId":"68","buyPrice":12.01,"sellPrice":15.48,"profit":3.47,"multi":1.29,"saleDate":"03/01/2026","receiveDate":"23/01/2026","createdAt":"2026-01-03T00:00:00.000Z"},{"id":"s0962","productId":"810","buyPrice":20.0,"sellPrice":35.48,"profit":15.48,"multi":1.77,"saleDate":"03/01/2026","receiveDate":"23/01/2026","createdAt":"2026-01-03T00:00:00.000Z"},{"id":"s0963","productId":"806","buyPrice":25.0,"sellPrice":40.67,"profit":15.67,"multi":1.63,"saleDate":"04/01/2026","receiveDate":"23/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s0964","productId":"671","buyPrice":20.63,"sellPrice":35.48,"profit":14.85,"multi":1.72,"saleDate":"02/01/2026","receiveDate":"23/01/2026","createdAt":"2026-01-02T00:00:00.000Z"},{"id":"s0965","productId":"771","buyPrice":25.0,"sellPrice":40.48,"profit":15.48,"multi":1.62,"saleDate":"04/01/2026","receiveDate":"23/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s0966","productId":"692","buyPrice":9.68,"sellPrice":25.48,"profit":15.8,"multi":2.63,"saleDate":"03/01/2026","receiveDate":"23/01/2026","createdAt":"2026-01-03T00:00:00.000Z"},{"id":"s0967","productId":"1085","buyPrice":26.91,"sellPrice":46.38,"profit":19.47,"multi":1.72,"saleDate":"01/01/2026","receiveDate":"23/01/2026","createdAt":"2026-01-01T00:00:00.000Z"},{"id":"s0968","productId":"1063","buyPrice":25.81,"sellPrice":49.48,"profit":23.67,"multi":1.92,"saleDate":"05/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-05T00:00:00.000Z"},{"id":"s0969","productId":"1043","buyPrice":10.0,"sellPrice":27.54,"profit":17.54,"multi":2.75,"saleDate":"03/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-03T00:00:00.000Z"},{"id":"s0970","productId":"1082","buyPrice":40.33,"sellPrice":78.48,"profit":38.15,"multi":1.95,"saleDate":"04/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s0971","productId":"Ski","buyPrice":13.0,"sellPrice":28.5,"profit":15.5,"multi":2.19,"saleDate":"03/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-03T00:00:00.000Z"},{"id":"s0972","productId":"1102","buyPrice":30.41,"sellPrice":65.53,"profit":35.12,"multi":2.15,"saleDate":"04/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s0973","productId":"953","buyPrice":26.81,"sellPrice":57.35,"profit":30.54,"multi":2.14,"saleDate":"05/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-05T00:00:00.000Z"},{"id":"s0974","productId":"Lot 3 spezial","buyPrice":66.21,"sellPrice":130.63,"profit":64.42,"multi":1.97,"saleDate":"04/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s0975","productId":"1061","buyPrice":24.7,"sellPrice":49.85,"profit":25.15,"multi":2.02,"saleDate":"03/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-03T00:00:00.000Z"},{"id":"s0976","productId":"819","buyPrice":15.0,"sellPrice":101.25,"profit":86.25,"multi":6.75,"saleDate":"21/12/2025","receiveDate":"26/01/2026","createdAt":"2025-12-21T00:00:00.000Z"},{"id":"s0977","productId":"627","buyPrice":19.45,"sellPrice":15.88,"profit":-3.57,"multi":0.82,"saleDate":"29/12/2025","receiveDate":"26/01/2026","createdAt":"2025-12-29T00:00:00.000Z"},{"id":"s0978","productId":"412","buyPrice":20.84,"sellPrice":33.48,"profit":12.64,"multi":1.61,"saleDate":"03/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-03T00:00:00.000Z"},{"id":"s0979","productId":"957","buyPrice":26.81,"sellPrice":57.5,"profit":30.69,"multi":2.14,"saleDate":"01/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-01T00:00:00.000Z"},{"id":"s0980","productId":"95","buyPrice":7.5,"sellPrice":12.48,"profit":4.98,"multi":1.66,"saleDate":"03/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-03T00:00:00.000Z"},{"id":"s0981","productId":"277","buyPrice":21.64,"sellPrice":30.48,"profit":8.84,"multi":1.41,"saleDate":"05/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-05T00:00:00.000Z"},{"id":"s0982","productId":"1105","buyPrice":14.28,"sellPrice":40.08,"profit":25.8,"multi":2.81,"saleDate":"04/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s0983","productId":"724","buyPrice":24.5,"sellPrice":30.5,"profit":6.0,"multi":1.24,"saleDate":"04/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s0984","productId":"574","buyPrice":20.6,"sellPrice":30.5,"profit":9.9,"multi":1.48,"saleDate":"04/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s0985","productId":"1039","buyPrice":22.0,"sellPrice":43.03,"profit":21.03,"multi":1.96,"saleDate":"16/12/2025","receiveDate":"26/01/2026","createdAt":"2025-12-16T00:00:00.000Z"},{"id":"s0986","productId":"518","buyPrice":15.99,"sellPrice":38.54,"profit":22.55,"multi":2.41,"saleDate":"02/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-02T00:00:00.000Z"},{"id":"s0987","productId":"867","buyPrice":24.51,"sellPrice":42.5,"profit":17.99,"multi":1.73,"saleDate":"31/12/2025","receiveDate":"26/01/2026","createdAt":"2025-12-31T00:00:00.000Z"},{"id":"s0988","productId":"1057","buyPrice":26.62,"sellPrice":49.22,"profit":22.6,"multi":1.85,"saleDate":"21/12/2025","receiveDate":"26/01/2026","createdAt":"2025-12-21T00:00:00.000Z"},{"id":"s0989","productId":"1090","buyPrice":14.89,"sellPrice":35.89,"profit":21.0,"multi":2.41,"saleDate":"04/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s0990","productId":"1079","buyPrice":14.89,"sellPrice":44.5,"profit":29.61,"multi":2.99,"saleDate":"01/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-01T00:00:00.000Z"},{"id":"s0991","productId":"900","buyPrice":19.49,"sellPrice":44.5,"profit":25.01,"multi":2.28,"saleDate":"04/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s0992","productId":"822","buyPrice":19.49,"sellPrice":44.55,"profit":25.06,"multi":2.29,"saleDate":"01/01/2026","receiveDate":"26/01/2026","createdAt":"2026-01-01T00:00:00.000Z"},{"id":"s0993","productId":"563","buyPrice":17.47,"sellPrice":40.73,"profit":23.26,"multi":2.33,"saleDate":"31/12/2025","receiveDate":"26/01/2026","createdAt":"2025-12-31T00:00:00.000Z"},{"id":"s0994","productId":"1076","buyPrice":27.89,"sellPrice":48.5,"profit":20.61,"multi":1.74,"saleDate":"31/12/2025","receiveDate":"27/01/2026","createdAt":"2025-12-31T00:00:00.000Z"},{"id":"s0995","productId":"369","buyPrice":15.99,"sellPrice":18.5,"profit":2.51,"multi":1.16,"saleDate":"03/01/2026","receiveDate":"27/01/2026","createdAt":"2026-01-03T00:00:00.000Z"},{"id":"s0996","productId":"1119","buyPrice":17.29,"sellPrice":45.53,"profit":28.24,"multi":2.63,"saleDate":"05/01/2026","receiveDate":"27/01/2026","createdAt":"2026-01-05T00:00:00.000Z"},{"id":"s0997","productId":"466","buyPrice":14.29,"sellPrice":28.5,"profit":14.21,"multi":1.99,"saleDate":"01/01/2026","receiveDate":"27/01/2026","createdAt":"2026-01-01T00:00:00.000Z"},{"id":"s0998","productId":"200","buyPrice":17.49,"sellPrice":22.5,"profit":5.01,"multi":1.29,"saleDate":"01/01/2026","receiveDate":"27/01/2026","createdAt":"2026-01-01T00:00:00.000Z"},{"id":"s0999","productId":"981","buyPrice":17.47,"sellPrice":35.36,"profit":17.89,"multi":2.02,"saleDate":"06/01/2026","receiveDate":"27/01/2026","createdAt":"2026-01-06T00:00:00.000Z"},{"id":"s1000","productId":"972","buyPrice":11.22,"sellPrice":25.5,"profit":14.28,"multi":2.27,"saleDate":"05/01/2026","receiveDate":"27/01/2026","createdAt":"2026-01-05T00:00:00.000Z"},{"id":"s1001","productId":"436","buyPrice":26.09,"sellPrice":35.86,"profit":9.77,"multi":1.37,"saleDate":"04/01/2026","receiveDate":"27/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s1002","productId":"1094","buyPrice":26.09,"sellPrice":50.5,"profit":24.41,"multi":1.94,"saleDate":"03/01/2026","receiveDate":"27/01/2026","createdAt":"2026-01-03T00:00:00.000Z"},{"id":"s1003","productId":"1112","buyPrice":24.7,"sellPrice":45.5,"profit":20.8,"multi":1.84,"saleDate":"07/01/2026","receiveDate":"27/01/2026","createdAt":"2026-01-07T00:00:00.000Z"},{"id":"s1004","productId":"1075","buyPrice":27.95,"sellPrice":56.22,"profit":28.27,"multi":2.01,"saleDate":"31/12/2025","receiveDate":"27/01/2026","createdAt":"2025-12-31T00:00:00.000Z"},{"id":"s1005","productId":"1124","buyPrice":14.79,"sellPrice":30.5,"profit":15.71,"multi":2.06,"saleDate":"06/01/2026","receiveDate":"27/01/2026","createdAt":"2026-01-06T00:00:00.000Z"},{"id":"s1006","productId":"1080","buyPrice":14.89,"sellPrice":34.5,"profit":19.61,"multi":2.32,"saleDate":"31/12/2025","receiveDate":"27/01/2026","createdAt":"2025-12-31T00:00:00.000Z"},{"id":"s1007","productId":"1001","buyPrice":23.5,"sellPrice":56.6,"profit":33.1,"multi":2.41,"saleDate":"04/01/2026","receiveDate":"27/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s1008","productId":"807","buyPrice":25.0,"sellPrice":30.5,"profit":5.5,"multi":1.22,"saleDate":"05/01/2026","receiveDate":"27/01/2026","createdAt":"2026-01-05T00:00:00.000Z"},{"id":"s1009","productId":"1081","buyPrice":10.11,"sellPrice":28.5,"profit":18.39,"multi":2.82,"saleDate":"31/12/2025","receiveDate":"27/01/2026","createdAt":"2025-12-31T00:00:00.000Z"},{"id":"s1010","productId":"784","buyPrice":24.0,"sellPrice":44.5,"profit":20.5,"multi":1.85,"saleDate":"04/01/2026","receiveDate":"28/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s1011","productId":"921","buyPrice":26.81,"sellPrice":65.54,"profit":38.73,"multi":2.44,"saleDate":"04/01/2026","receiveDate":"28/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s1012","productId":"1095","buyPrice":15.0,"sellPrice":33.73,"profit":18.73,"multi":2.25,"saleDate":"03/01/2026","receiveDate":"28/01/2026","createdAt":"2026-01-03T00:00:00.000Z"},{"id":"s1013","productId":"504","buyPrice":15.99,"sellPrice":35.81,"profit":19.82,"multi":2.24,"saleDate":"02/01/2026","receiveDate":"28/01/2026","createdAt":"2026-01-02T00:00:00.000Z"},{"id":"s1014","productId":"Lot 3 articles","buyPrice":74.66,"sellPrice":145.63,"profit":70.97,"multi":1.95,"saleDate":"11/01/2026","receiveDate":"28/01/2026","createdAt":"2026-01-11T00:00:00.000Z"},{"id":"s1015","productId":"632","buyPrice":9.58,"sellPrice":8.03,"profit":-1.55,"multi":0.84,"saleDate":"31/12/2025","receiveDate":"28/01/2026","createdAt":"2025-12-31T00:00:00.000Z"},{"id":"s1016","productId":"401","buyPrice":21.64,"sellPrice":30.48,"profit":8.84,"multi":1.41,"saleDate":"08/01/2026","receiveDate":"28/01/2026","createdAt":"2026-01-08T00:00:00.000Z"},{"id":"s1017","productId":"1127","buyPrice":26.91,"sellPrice":50.48,"profit":23.57,"multi":1.88,"saleDate":"09/01/2026","receiveDate":"29/10/2026","createdAt":"2026-01-09T00:00:00.000Z"},{"id":"s1018","productId":"491","buyPrice":11.61,"sellPrice":34.5,"profit":22.89,"multi":2.97,"saleDate":"05/01/2026","receiveDate":"28/01/2026","createdAt":"2026-01-05T00:00:00.000Z"},{"id":"s1019","productId":"1092","buyPrice":10.61,"sellPrice":20.5,"profit":9.89,"multi":1.93,"saleDate":"03/01/2026","receiveDate":"28/01/2026","createdAt":"2026-01-03T00:00:00.000Z"},{"id":"s1020","productId":"869","buyPrice":22.1,"sellPrice":39.48,"profit":17.38,"multi":1.79,"saleDate":"02/01/2026","receiveDate":"28/01/2026","createdAt":"2026-01-02T00:00:00.000Z"},{"id":"s1021","productId":"1024","buyPrice":19.49,"sellPrice":56.5,"profit":37.01,"multi":2.9,"saleDate":"02/01/2026","receiveDate":"28/01/2026","createdAt":"2026-01-02T00:00:00.000Z"},{"id":"s1022","productId":"453","buyPrice":12.2,"sellPrice":30.25,"profit":18.05,"multi":2.48,"saleDate":"21/12/2025","receiveDate":"29/01/2026","createdAt":"2025-12-21T00:00:00.000Z"},{"id":"s1023","productId":"1078","buyPrice":25.21,"sellPrice":50.21,"profit":25.0,"multi":1.99,"saleDate":"01/01/2026","receiveDate":"29/01/2026","createdAt":"2026-01-01T00:00:00.000Z"},{"id":"s1024","productId":"1046","buyPrice":22.0,"sellPrice":31.5,"profit":9.5,"multi":1.43,"saleDate":"03/01/2026","receiveDate":"29/01/2026","createdAt":"2026-01-03T00:00:00.000Z"},{"id":"s1025","productId":"1146","buyPrice":19.73,"sellPrice":42.78,"profit":23.05,"multi":2.17,"saleDate":"10/01/2026","receiveDate":"29/01/2026","createdAt":"2026-01-10T00:00:00.000Z"},{"id":"s1026","productId":"763","buyPrice":13.88,"sellPrice":38.5,"profit":24.62,"multi":2.77,"saleDate":"12/01/2026","receiveDate":"29/01/2026","createdAt":"2026-01-12T00:00:00.000Z"},{"id":"s1027","productId":"1035","buyPrice":22.0,"sellPrice":30.71,"profit":8.71,"multi":1.4,"saleDate":"06/01/2026","receiveDate":"30/01/2026","createdAt":"2026-01-06T00:00:00.000Z"},{"id":"s1028","productId":"1143","buyPrice":24.51,"sellPrice":46.73,"profit":22.22,"multi":1.91,"saleDate":"11/01/2026","receiveDate":"30/01/2026","createdAt":"2026-01-11T00:00:00.000Z"},{"id":"s1029","productId":"1145","buyPrice":9.04,"sellPrice":27.73,"profit":18.69,"multi":3.07,"saleDate":"11/01/2026","receiveDate":"30/01/2026","createdAt":"2026-01-11T00:00:00.000Z"},{"id":"s1030","productId":"746","buyPrice":8.88,"sellPrice":19.68,"profit":10.8,"multi":2.22,"saleDate":"31/12/2025","receiveDate":"30/01/2026","createdAt":"2025-12-31T00:00:00.000Z"},{"id":"s1031","productId":"528","buyPrice":12.2,"sellPrice":30.5,"profit":18.3,"multi":2.5,"saleDate":"02/01/2026","receiveDate":"30/01/2026","createdAt":"2026-01-02T00:00:00.000Z"},{"id":"s1032","productId":"835","buyPrice":24.7,"sellPrice":52.53,"profit":27.83,"multi":2.13,"saleDate":"04/01/2026","receiveDate":"30/01/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s1033","productId":"549","buyPrice":27.09,"sellPrice":30.89,"profit":3.8,"multi":1.14,"saleDate":"08/01/2026","receiveDate":"30/01/2026","createdAt":"2026-01-08T00:00:00.000Z"},{"id":"s1034","productId":"674","buyPrice":19.3,"sellPrice":35.71,"profit":16.41,"multi":1.85,"saleDate":"10/01/2026","receiveDate":"30/01/2026","createdAt":"2026-01-10T00:00:00.000Z"},{"id":"s1035","productId":"637","buyPrice":11.84,"sellPrice":35.58,"profit":23.74,"multi":3.01,"saleDate":"12/01/2026","receiveDate":"30/01/2026","createdAt":"2026-01-12T00:00:00.000Z"},{"id":"s1036","productId":"1142","buyPrice":14.89,"sellPrice":29.98,"profit":15.09,"multi":2.01,"saleDate":"11/01/2026","receiveDate":"30/01/2026","createdAt":"2026-01-11T00:00:00.000Z"},{"id":"s1037","productId":"645","buyPrice":23.72,"sellPrice":39.98,"profit":16.26,"multi":1.69,"saleDate":"12/01/2026","receiveDate":"02/02/2026","createdAt":"2026-01-12T00:00:00.000Z"},{"id":"s1038","productId":"1047","buyPrice":25.81,"sellPrice":39.67,"profit":13.86,"multi":1.54,"saleDate":"12/01/2026","receiveDate":"02/02/2026","createdAt":"2026-01-12T00:00:00.000Z"},{"id":"s1039","productId":"1151","buyPrice":32.5,"sellPrice":69.21,"profit":36.71,"multi":2.13,"saleDate":"13/01/2026","receiveDate":"02/02/2026","createdAt":"2026-01-13T00:00:00.000Z"},{"id":"s1040","productId":"715","buyPrice":24.51,"sellPrice":45.5,"profit":20.99,"multi":1.86,"saleDate":"02/01/2026","receiveDate":"02/02/2026","createdAt":"2026-01-02T00:00:00.000Z"},{"id":"s1041","productId":"1136","buyPrice":23.49,"sellPrice":48.5,"profit":25.01,"multi":2.06,"saleDate":"11/01/2026","receiveDate":"02/02/2026","createdAt":"2026-01-11T00:00:00.000Z"},{"id":"s1042","productId":"619","buyPrice":9.74,"sellPrice":42.5,"profit":32.76,"multi":4.36,"saleDate":"10/01/2026","receiveDate":"02/02/2026","createdAt":"2026-01-10T00:00:00.000Z"},{"id":"s1043","productId":"363","buyPrice":22.34,"sellPrice":38.21,"profit":15.87,"multi":1.71,"saleDate":"09/01/2026","receiveDate":"02/02/2026","createdAt":"2026-01-09T00:00:00.000Z"},{"id":"s1044","productId":"1084","buyPrice":13.88,"sellPrice":30.5,"profit":16.62,"multi":2.2,"saleDate":"01/01/2026","receiveDate":"02/02/2026","createdAt":"2026-01-01T00:00:00.000Z"},{"id":"s1045","productId":"940","buyPrice":29.9,"sellPrice":57.53,"profit":27.63,"multi":1.92,"saleDate":"02/01/2026","receiveDate":"02/02/2026","createdAt":"2026-01-02T00:00:00.000Z"},{"id":"s1046","productId":"1114","buyPrice":26.91,"sellPrice":52.5,"profit":25.59,"multi":1.95,"saleDate":"13/01/2026","receiveDate":"02/02/2026","createdAt":"2026-01-13T00:00:00.000Z"},{"id":"s1047","productId":"838","buyPrice":20.56,"sellPrice":45.71,"profit":25.15,"multi":2.22,"saleDate":"01/01/2026","receiveDate":"02/02/2026","createdAt":"2026-01-01T00:00:00.000Z"},{"id":"s1048","productId":"1126","buyPrice":10.96,"sellPrice":24.71,"profit":13.75,"multi":2.25,"saleDate":"09/01/2026","receiveDate":"03/02/2026","createdAt":"2026-01-09T00:00:00.000Z"},{"id":"s1049","productId":"1113","buyPrice":22.0,"sellPrice":44.5,"profit":22.5,"multi":2.02,"saleDate":"05/01/2026","receiveDate":"03/02/2026","createdAt":"2026-01-05T00:00:00.000Z"},{"id":"s1050","productId":"1137","buyPrice":25.86,"sellPrice":56.5,"profit":30.64,"multi":2.18,"saleDate":"10/01/2026","receiveDate":"03/02/2026","createdAt":"2026-01-10T00:00:00.000Z"},{"id":"s1051","productId":"636","buyPrice":20.6,"sellPrice":41.75,"profit":21.15,"multi":2.03,"saleDate":"10/01/2026","receiveDate":"03/02/2026","createdAt":"2026-01-10T00:00:00.000Z"},{"id":"s1052","productId":"1029","buyPrice":21.6,"sellPrice":35.53,"profit":13.93,"multi":1.64,"saleDate":"09/01/2026","receiveDate":"03/02/2026","createdAt":"2026-01-09T00:00:00.000Z"},{"id":"s1053","productId":"1159","buyPrice":11.2,"sellPrice":30.5,"profit":19.3,"multi":2.72,"saleDate":"14/01/2026","receiveDate":"04/02/2026","createdAt":"2026-01-14T00:00:00.000Z"},{"id":"s1054","productId":"1162","buyPrice":16.45,"sellPrice":30.86,"profit":14.41,"multi":1.88,"saleDate":"15/01/2026","receiveDate":"04/02/2026","createdAt":"2026-01-15T00:00:00.000Z"},{"id":"s1055","productId":"1147","buyPrice":22.0,"sellPrice":43.48,"profit":21.48,"multi":1.98,"saleDate":"13/01/2026","receiveDate":"04/02/2026","createdAt":"2026-01-13T00:00:00.000Z"},{"id":"s1056","productId":"839","buyPrice":13.88,"sellPrice":39.48,"profit":25.6,"multi":2.84,"saleDate":"14/01/2026","receiveDate":"04/02/2026","createdAt":"2026-01-14T00:00:00.000Z"},{"id":"s1057","productId":"830","buyPrice":26.81,"sellPrice":47.71,"profit":20.9,"multi":1.78,"saleDate":"14/01/2026","receiveDate":"05/02/2026","createdAt":"2026-01-14T00:00:00.000Z"},{"id":"s1058","productId":"1149","buyPrice":16.09,"sellPrice":45.5,"profit":29.41,"multi":2.83,"saleDate":"12/01/2026","receiveDate":"05/02/2026","createdAt":"2026-01-12T00:00:00.000Z"},{"id":"s1059","productId":"1096","buyPrice":20.0,"sellPrice":38.73,"profit":18.73,"multi":1.94,"saleDate":"09/01/2026","receiveDate":"05/02/2026","createdAt":"2026-01-09T00:00:00.000Z"},{"id":"s1060","productId":"713","buyPrice":24.7,"sellPrice":41.03,"profit":16.33,"multi":1.66,"saleDate":"04/01/2026","receiveDate":"05/02/2026","createdAt":"2026-01-04T00:00:00.000Z"},{"id":"s1061","productId":"1118","buyPrice":25.2,"sellPrice":60.48,"profit":35.28,"multi":2.4,"saleDate":"16/01/2026","receiveDate":"05/02/2026","createdAt":"2026-01-16T00:00:00.000Z"},{"id":"s1062","productId":"1107 et 1098","buyPrice":29.1,"sellPrice":65.73,"profit":36.63,"multi":2.26,"saleDate":"14/01/2026","receiveDate":"05/02/2026","createdAt":"2026-01-14T00:00:00.000Z"},{"id":"s1063","productId":"873","buyPrice":24.76,"sellPrice":40.48,"profit":15.72,"multi":1.63,"saleDate":"18/01/2026","receiveDate":"06/02/2026","createdAt":"2026-01-18T00:00:00.000Z"},{"id":"s1064","productId":"714","buyPrice":30.0,"sellPrice":40.48,"profit":10.48,"multi":1.35,"saleDate":"18/01/2026","receiveDate":"06/02/2026","createdAt":"2026-01-18T00:00:00.000Z"},{"id":"s1065","productId":"998","buyPrice":23.68,"sellPrice":42.48,"profit":18.8,"multi":1.79,"saleDate":"14/01/2026","receiveDate":"09/02/2026","createdAt":"2026-01-14T00:00:00.000Z"},{"id":"s1066","productId":"904","buyPrice":25.81,"sellPrice":49.27,"profit":23.46,"multi":1.91,"saleDate":"18/01/2026","receiveDate":"09/02/2026","createdAt":"2026-01-18T00:00:00.000Z"},{"id":"s1067","productId":"896","buyPrice":21.42,"sellPrice":50.73,"profit":29.31,"multi":2.37,"saleDate":"18/01/2026","receiveDate":"09/02/2026","createdAt":"2026-01-18T00:00:00.000Z"},{"id":"s1068","productId":"1128","buyPrice":9.68,"sellPrice":21.25,"profit":11.57,"multi":2.2,"saleDate":"13/01/2026","receiveDate":"09/02/2026","createdAt":"2026-01-13T00:00:00.000Z"},{"id":"s1069","productId":"785","buyPrice":25.0,"sellPrice":48.54,"profit":23.54,"multi":1.94,"saleDate":"17/01/2026","receiveDate":"09/02/2026","createdAt":"2026-01-17T00:00:00.000Z"},{"id":"s1070","productId":"1156","buyPrice":26.87,"sellPrice":55.0,"profit":28.13,"multi":2.05,"saleDate":"20/01/2026","receiveDate":"09/02/2026","createdAt":"2026-01-20T00:00:00.000Z"},{"id":"s1071","productId":"1171","buyPrice":25.59,"sellPrice":47.5,"profit":21.91,"multi":1.86,"saleDate":"17/01/2026","receiveDate":"09/02/2026","createdAt":"2026-01-17T00:00:00.000Z"},{"id":"s1072","productId":"1201","buyPrice":15.0,"sellPrice":32.53,"profit":17.53,"multi":2.17,"saleDate":"19/01/2026","receiveDate":"09/02/2026","createdAt":"2026-01-19T00:00:00.000Z"},{"id":"s1073","productId":"1175","buyPrice":11.5,"sellPrice":30.5,"profit":19.0,"multi":2.65,"saleDate":"19/01/2026","receiveDate":"09/02/2026","createdAt":"2026-01-19T00:00:00.000Z"},{"id":"s1074","productId":"875","buyPrice":15.96,"sellPrice":40.86,"profit":24.9,"multi":2.56,"saleDate":"18/01/2026","receiveDate":"09/02/2026","createdAt":"2026-01-18T00:00:00.000Z"},{"id":"s1075","productId":"1135","buyPrice":21.94,"sellPrice":49.73,"profit":27.79,"multi":2.27,"saleDate":"18/01/2026","receiveDate":"10/02/2026","createdAt":"2026-01-18T00:00:00.000Z"},{"id":"s1076","productId":"1213","buyPrice":18.0,"sellPrice":32.73,"profit":14.73,"multi":1.82,"saleDate":"19/01/2026","receiveDate":"10/02/2026","createdAt":"2026-01-19T00:00:00.000Z"},{"id":"s1077","productId":"1166","buyPrice":28.99,"sellPrice":59.48,"profit":30.49,"multi":2.05,"saleDate":"21/01/2026","receiveDate":"11/02/2026","createdAt":"2026-01-21T00:00:00.000Z"},{"id":"s1078","productId":"1203","buyPrice":22.68,"sellPrice":50.75,"profit":28.07,"multi":2.24,"saleDate":"19/01/2026","receiveDate":"11/02/2026","createdAt":"2026-01-19T00:00:00.000Z"},{"id":"s1079","productId":"1220","buyPrice":24.7,"sellPrice":45.54,"profit":20.84,"multi":1.84,"saleDate":"23/01/2026","receiveDate":"11/02/2026","createdAt":"2026-01-23T00:00:00.000Z"},{"id":"s1080","productId":"1148","buyPrice":32.07,"sellPrice":63.86,"profit":31.79,"multi":1.99,"saleDate":"24/01/2026","receiveDate":"11/02/2026","createdAt":"2026-01-24T00:00:00.000Z"},{"id":"s1081","productId":"1208","buyPrice":26.78,"sellPrice":58.5,"profit":31.72,"multi":2.18,"saleDate":"21/01/2026","receiveDate":"11/02/2026","createdAt":"2026-01-21T00:00:00.000Z"},{"id":"s1082","productId":"1183","buyPrice":35.08,"sellPrice":75.54,"profit":40.46,"multi":2.15,"saleDate":"21/01/2026","receiveDate":"11/02/2026","createdAt":"2026-01-21T00:00:00.000Z"},{"id":"s1083","productId":"1168","buyPrice":25.59,"sellPrice":52.71,"profit":27.12,"multi":2.06,"saleDate":"20/01/2026","receiveDate":"11/02/2026","createdAt":"2026-01-20T00:00:00.000Z"},{"id":"s1084","productId":"1216","buyPrice":29.3,"sellPrice":71.6,"profit":42.3,"multi":2.44,"saleDate":"22/01/2026","receiveDate":"11/02/2026","createdAt":"2026-01-22T00:00:00.000Z"},{"id":"s1085","productId":"1027","buyPrice":24.51,"sellPrice":55.48,"profit":30.97,"multi":2.26,"saleDate":"22/01/2026","receiveDate":"11/02/2026","createdAt":"2026-01-22T00:00:00.000Z"},{"id":"s1086","productId":"1150","buyPrice":22.01,"sellPrice":48.86,"profit":26.85,"multi":2.22,"saleDate":"17/01/2026","receiveDate":"12/02/2026","createdAt":"2026-01-17T00:00:00.000Z"},{"id":"s1087","productId":"1251","buyPrice":11.39,"sellPrice":38.67,"profit":27.28,"multi":3.4,"saleDate":"25/01/2026","receiveDate":"12/02/2026","createdAt":"2026-01-25T00:00:00.000Z"},{"id":"s1088","productId":"1187","buyPrice":9.48,"sellPrice":22.1,"profit":12.62,"multi":2.33,"saleDate":"18/01/2026","receiveDate":"12/01/2026","createdAt":"2026-01-18T00:00:00.000Z"},{"id":"s1089","productId":"1169","buyPrice":24.44,"sellPrice":48.48,"profit":24.04,"multi":1.98,"saleDate":"23/01/2026","receiveDate":"12/02/2026","createdAt":"2026-01-23T00:00:00.000Z"},{"id":"s1090","productId":"1222","buyPrice":26.87,"sellPrice":46.54,"profit":19.67,"multi":1.73,"saleDate":"24/01/2026","receiveDate":"12/02/2026","createdAt":"2026-01-24T00:00:00.000Z"},{"id":"s1091","productId":"1206","buyPrice":30.84,"sellPrice":67.46,"profit":36.62,"multi":2.19,"saleDate":"24/01/2026","receiveDate":"12/02/2026","createdAt":"2026-01-24T00:00:00.000Z"},{"id":"s1092","productId":"1235","buyPrice":23.0,"sellPrice":46.5,"profit":23.5,"multi":2.02,"saleDate":"25/01/2026","receiveDate":"12/02/2026","createdAt":"2026-01-25T00:00:00.000Z"},{"id":"s1093","productId":"1005","buyPrice":24.3,"sellPrice":47.48,"profit":23.18,"multi":1.95,"saleDate":"24/01/2026","receiveDate":"13/02/2026","createdAt":"2026-01-24T00:00:00.000Z"},{"id":"s1094","productId":"1247","buyPrice":15.0,"sellPrice":30.0,"profit":15.0,"multi":2.0,"saleDate":"25/01/2026","receiveDate":"13/02/2026","createdAt":"2026-01-25T00:00:00.000Z"},{"id":"s1095","productId":"1025","buyPrice":22.0,"sellPrice":29.99,"profit":7.99,"multi":1.36,"saleDate":"17/01/2026","receiveDate":"13/02/2026","createdAt":"2026-01-17T00:00:00.000Z"},{"id":"s1096","productId":"1167","buyPrice":9.84,"sellPrice":20.73,"profit":10.89,"multi":2.11,"saleDate":"23/01/2026","receiveDate":"13/02/2026","createdAt":"2026-01-23T00:00:00.000Z"},{"id":"s1097","productId":"859","buyPrice":22.0,"sellPrice":40.03,"profit":18.03,"multi":1.82,"saleDate":"23/01/2026","receiveDate":"13/02/2026","createdAt":"2026-01-23T00:00:00.000Z"},{"id":"s1098","productId":"1192","buyPrice":17.49,"sellPrice":34.0,"profit":16.51,"multi":1.94,"saleDate":"19/01/2026","receiveDate":"13/02/2026","createdAt":"2026-01-19T00:00:00.000Z"},{"id":"s1099","productId":"1218","buyPrice":24.7,"sellPrice":50.48,"profit":25.78,"multi":2.04,"saleDate":"24/01/2026","receiveDate":"13/02/2026","createdAt":"2026-01-24T00:00:00.000Z"},{"id":"s1100","productId":"842","buyPrice":22.0,"sellPrice":40.5,"profit":18.5,"multi":1.84,"saleDate":"24/01/2026","receiveDate":"13/02/2026","createdAt":"2026-01-24T00:00:00.000Z"},{"id":"s1101","productId":"676","buyPrice":19.73,"sellPrice":40.71,"profit":20.98,"multi":2.06,"saleDate":"23/01/2026","receiveDate":"16/02/2026","createdAt":"2026-01-23T00:00:00.000Z"},{"id":"s1102","productId":"662","buyPrice":26.09,"sellPrice":41.25,"profit":15.16,"multi":1.58,"saleDate":"23/01/2026","receiveDate":"16/02/2026","createdAt":"2026-01-23T00:00:00.000Z"},{"id":"s1103","productId":"1199","buyPrice":11.0,"sellPrice":21.25,"profit":10.25,"multi":1.93,"saleDate":"23/01/2026","receiveDate":"16/02/2026","createdAt":"2026-01-23T00:00:00.000Z"},{"id":"s1104","productId":"1155","buyPrice":24.2,"sellPrice":55.86,"profit":31.66,"multi":2.31,"saleDate":"21/01/2026","receiveDate":"16/02/2026","createdAt":"2026-01-21T00:00:00.000Z"},{"id":"s1105","productId":"845","buyPrice":24.41,"sellPrice":36.71,"profit":12.3,"multi":1.5,"saleDate":"22/01/2026","receiveDate":"16/02/2026","createdAt":"2026-01-22T00:00:00.000Z"},{"id":"s1106","productId":"1253","buyPrice":16.69,"sellPrice":38.51,"profit":21.82,"multi":2.31,"saleDate":"26/01/2026","receiveDate":"16/02/2026","createdAt":"2026-01-26T00:00:00.000Z"},{"id":"s1107","productId":"1180","buyPrice":7.87,"sellPrice":43.53,"profit":35.66,"multi":5.53,"saleDate":"21/01/2026","receiveDate":"16/02/2026","createdAt":"2026-01-21T00:00:00.000Z"},{"id":"s1108","productId":"461","buyPrice":15.0,"sellPrice":35.71,"profit":20.71,"multi":2.38,"saleDate":"20/01/2026","receiveDate":"16/02/2026","createdAt":"2026-01-20T00:00:00.000Z"},{"id":"s1109","productId":"1244","buyPrice":11.0,"sellPrice":29.48,"profit":18.48,"multi":2.68,"saleDate":"26/01/2026","receiveDate":"16/02/2026","createdAt":"2026-01-26T00:00:00.000Z"},{"id":"s1110","productId":"727","buyPrice":25.81,"sellPrice":42.78,"profit":16.97,"multi":1.66,"saleDate":"29/01/2026","receiveDate":"16/02/2026","createdAt":"2026-01-29T00:00:00.000Z"},{"id":"s1111","productId":"1040","buyPrice":24.7,"sellPrice":43.68,"profit":18.98,"multi":1.77,"saleDate":"29/01/2026","receiveDate":"17/02/2026","createdAt":"2026-01-29T00:00:00.000Z"},{"id":"s1112","productId":"1170","buyPrice":19.49,"sellPrice":60.5,"profit":41.01,"multi":3.1,"saleDate":"27/01/2026","receiveDate":"18/02/2026","createdAt":"2026-01-27T00:00:00.000Z"},{"id":"s1113","productId":"1275","buyPrice":11.8,"sellPrice":37.5,"profit":25.7,"multi":3.18,"saleDate":"31/01/2026","receiveDate":"18/02/2026","createdAt":"2026-01-31T00:00:00.000Z"},{"id":"s1114","productId":"1182","buyPrice":26.07,"sellPrice":60.48,"profit":34.41,"multi":2.32,"saleDate":"28/01/2026","receiveDate":"18/02/2026","createdAt":"2026-01-28T00:00:00.000Z"},{"id":"s1115","productId":"1091","buyPrice":20.34,"sellPrice":40.5,"profit":20.16,"multi":1.99,"saleDate":"31/01/2026","receiveDate":"18/02/2026","createdAt":"2026-01-31T00:00:00.000Z"},{"id":"s1116","productId":"1248","buyPrice":24.51,"sellPrice":46.5,"profit":21.99,"multi":1.9,"saleDate":"26/01/2026","receiveDate":"18/02/2026","createdAt":"2026-01-26T00:00:00.000Z"},{"id":"s1117","productId":"534","buyPrice":20.6,"sellPrice":29.71,"profit":9.11,"multi":1.44,"saleDate":"25/01/2026","receiveDate":"19/02/2026","createdAt":"2026-01-25T00:00:00.000Z"},{"id":"s1118","productId":"1255","buyPrice":10.86,"sellPrice":35.48,"profit":24.62,"multi":3.27,"saleDate":"27/01/2026","receiveDate":"19/02/2026","createdAt":"2026-01-27T00:00:00.000Z"},{"id":"s1119","productId":"1249","buyPrice":19.09,"sellPrice":52.48,"profit":33.39,"multi":2.75,"saleDate":"28/01/2026","receiveDate":"19/02/2026","createdAt":"2026-01-28T00:00:00.000Z"},{"id":"s1120","productId":"989","buyPrice":24.51,"sellPrice":45.09,"profit":20.58,"multi":1.84,"saleDate":"31/01/2026","receiveDate":"19/02/2026","createdAt":"2026-01-31T00:00:00.000Z"},{"id":"s1121","productId":"854","buyPrice":19.3,"sellPrice":51.99,"profit":32.69,"multi":2.69,"saleDate":"01/02/2026","receiveDate":"19/02/2026","createdAt":"2026-02-01T00:00:00.000Z"},{"id":"s1122","productId":"1240","buyPrice":20.0,"sellPrice":52.86,"profit":32.86,"multi":2.64,"saleDate":"27/01/2026","receiveDate":"19/02/2026","createdAt":"2026-01-27T00:00:00.000Z"},{"id":"s1123","productId":"1303 et1250","buyPrice":33.0,"sellPrice":76.73,"profit":43.73,"multi":2.33,"saleDate":"01/02/2026","receiveDate":"19/02/2026","createdAt":"2026-02-01T00:00:00.000Z"},{"id":"s1124","productId":"1198","buyPrice":11.0,"sellPrice":28.71,"profit":17.71,"multi":2.61,"saleDate":"27/01/2026","receiveDate":"19/02/2026","createdAt":"2026-01-27T00:00:00.000Z"},{"id":"s1125","productId":"1231","buyPrice":24.7,"sellPrice":52.74,"profit":28.04,"multi":2.14,"saleDate":"01/02/2026","receiveDate":"19/02/2026","createdAt":"2026-02-01T00:00:00.000Z"},{"id":"s1126","productId":"1246","buyPrice":11.49,"sellPrice":23.7,"profit":12.21,"multi":2.06,"saleDate":"27/01/2026","receiveDate":"19/02/2026","createdAt":"2026-01-27T00:00:00.000Z"},{"id":"s1127","productId":"696","buyPrice":16.19,"sellPrice":31.25,"profit":15.06,"multi":1.93,"saleDate":"26/01/2026","receiveDate":"20/02/2026","createdAt":"2026-01-26T00:00:00.000Z"},{"id":"s1128","productId":"1224","buyPrice":20.0,"sellPrice":50.5,"profit":30.5,"multi":2.52,"saleDate":"01/02/2026","receiveDate":"20/02/2026","createdAt":"2026-02-01T00:00:00.000Z"},{"id":"s1129","productId":"1274","buyPrice":22.5,"sellPrice":43.48,"profit":20.98,"multi":1.93,"saleDate":"31/01/2026","receiveDate":"20/02/2026","createdAt":"2026-01-31T00:00:00.000Z"},{"id":"s1130","productId":"876","buyPrice":15.96,"sellPrice":45.53,"profit":29.57,"multi":2.85,"saleDate":"29/01/2026","receiveDate":"20/02/2026","createdAt":"2026-01-29T00:00:00.000Z"},{"id":"s1131","productId":"1281","buyPrice":19.3,"sellPrice":40.5,"profit":21.2,"multi":2.1,"saleDate":"01/02/2026","receiveDate":"20/02/2026","createdAt":"2026-02-01T00:00:00.000Z"},{"id":"s1132","productId":"1296","buyPrice":7.5,"sellPrice":19.71,"profit":12.21,"multi":2.63,"saleDate":"31/01/2026","receiveDate":"20/02/2026","createdAt":"2026-01-31T00:00:00.000Z"},{"id":"s1133","productId":"480","buyPrice":20.24,"sellPrice":60.78,"profit":40.54,"multi":3.0,"saleDate":"31/01/2026","receiveDate":"20/02/2026","createdAt":"2026-01-31T00:00:00.000Z"},{"id":"s1134","productId":"1219","buyPrice":25.34,"sellPrice":45.5,"profit":20.16,"multi":1.8,"saleDate":"31/01/2026","receiveDate":"23/02/2026","createdAt":"2026-01-31T00:00:00.000Z"},{"id":"s1135","productId":"1048","buyPrice":22.0,"sellPrice":32.48,"profit":10.48,"multi":1.48,"saleDate":"04/02/2026","receiveDate":"23/02/2026","createdAt":"2026-02-04T00:00:00.000Z"},{"id":"s1136","productId":"1016","buyPrice":20.6,"sellPrice":49.5,"profit":28.9,"multi":2.4,"saleDate":"01/02/2026","receiveDate":"23/02/2026","createdAt":"2026-02-01T00:00:00.000Z"},{"id":"s1137","productId":"1011","buyPrice":19.3,"sellPrice":39.5,"profit":20.2,"multi":2.05,"saleDate":"02/02/2026","receiveDate":"23/02/2026","createdAt":"2026-02-02T00:00:00.000Z"},{"id":"s1138","productId":"768","buyPrice":25.0,"sellPrice":45.5,"profit":20.5,"multi":1.82,"saleDate":"04/02/2026","receiveDate":"24/02/2026","createdAt":"2026-02-04T00:00:00.000Z"},{"id":"s1139","productId":"1239","buyPrice":12.5,"sellPrice":40.67,"profit":28.17,"multi":3.25,"saleDate":"06/02/2026","receiveDate":"24/02/2026","createdAt":"2026-02-06T00:00:00.000Z"},{"id":"s1140","productId":"1067","buyPrice":25.81,"sellPrice":47.73,"profit":21.92,"multi":1.85,"saleDate":"01/02/2026","receiveDate":"24/02/2026","createdAt":"2026-02-01T00:00:00.000Z"},{"id":"s1141","productId":"804","buyPrice":14.28,"sellPrice":23.88,"profit":9.6,"multi":1.67,"saleDate":"02/02/2026","receiveDate":"24/02/2026","createdAt":"2026-02-02T00:00:00.000Z"},{"id":"s1142","productId":"1260et 1304","buyPrice":30.0,"sellPrice":76.33,"profit":46.33,"multi":2.54,"saleDate":"05/02/2026","receiveDate":"24/02/2026","createdAt":"2026-02-05T00:00:00.000Z"},{"id":"s1143","productId":"1319","buyPrice":15.65,"sellPrice":38.49,"profit":22.84,"multi":2.46,"saleDate":"06/02/2026","receiveDate":"24/02/2026","createdAt":"2026-02-06T00:00:00.000Z"},{"id":"s1144","productId":"791","buyPrice":25.0,"sellPrice":30.5,"profit":5.5,"multi":1.22,"saleDate":"07/02/2026","receiveDate":"25/02/2026","createdAt":"2026-02-07T00:00:00.000Z"},{"id":"s1145","productId":"1310","buyPrice":9.07,"sellPrice":18.5,"profit":9.43,"multi":2.04,"saleDate":"03/02/2026","receiveDate":"25/02/2026","createdAt":"2026-02-03T00:00:00.000Z"},{"id":"s1146","productId":"544","buyPrice":14.18,"sellPrice":30.5,"profit":16.32,"multi":2.15,"saleDate":"29/01/2026","receiveDate":"25/02/2026","createdAt":"2026-01-29T00:00:00.000Z"},{"id":"s1147","productId":"340","buyPrice":15.39,"sellPrice":40.5,"profit":25.11,"multi":2.63,"saleDate":"06/02/2026","receiveDate":"25/02/2026","createdAt":"2026-02-06T00:00:00.000Z"},{"id":"s1148","productId":"310","buyPrice":6.01,"sellPrice":17.5,"profit":11.49,"multi":2.91,"saleDate":"05/02/2026","receiveDate":"15/02/2026","createdAt":"2026-02-05T00:00:00.000Z"},{"id":"s1149","productId":"1302","buyPrice":24.5,"sellPrice":45.48,"profit":20.98,"multi":1.86,"saleDate":"04/02/2026","receiveDate":"25/02/2026","createdAt":"2026-02-04T00:00:00.000Z"},{"id":"s1150","productId":"1071","buyPrice":10.18,"sellPrice":26.78,"profit":16.6,"multi":2.63,"saleDate":"31/01/2026","receiveDate":"25/02/2026","createdAt":"2026-01-31T00:00:00.000Z"},{"id":"s1151","productId":"608","buyPrice":14.28,"sellPrice":35.86,"profit":21.58,"multi":2.51,"saleDate":"05/02/2026","receiveDate":"25/02/2026","createdAt":"2026-02-05T00:00:00.000Z"},{"id":"s1152","productId":"969","buyPrice":24.3,"sellPrice":42.73,"profit":18.43,"multi":1.76,"saleDate":"04/02/2026","receiveDate":"25/02/2026","createdAt":"2026-02-04T00:00:00.000Z"},{"id":"s1153","productId":"1305","buyPrice":8.54,"sellPrice":18.5,"profit":9.96,"multi":2.17,"saleDate":"04/02/2026","receiveDate":"25/02/2026","createdAt":"2026-02-04T00:00:00.000Z"},{"id":"s1154","productId":"1144","buyPrice":22.0,"sellPrice":47.3,"profit":25.3,"multi":2.15,"saleDate":"03/02/2026","receiveDate":"26/02/2026","createdAt":"2026-02-03T00:00:00.000Z"},{"id":"s1155","productId":"1278","buyPrice":7.5,"sellPrice":22.48,"profit":14.98,"multi":3.0,"saleDate":"05/02/2026","receiveDate":"26/02/2026","createdAt":"2026-02-05T00:00:00.000Z"},{"id":"s1156","productId":"1179","buyPrice":20.84,"sellPrice":50.48,"profit":29.64,"multi":2.42,"saleDate":"06/02/2026","receiveDate":"26/02/2026","createdAt":"2026-02-06T00:00:00.000Z"},{"id":"s1157","productId":"991","buyPrice":24.7,"sellPrice":43.48,"profit":18.78,"multi":1.76,"saleDate":"05/02/2026","receiveDate":"26/02/2026","createdAt":"2026-02-05T00:00:00.000Z"},{"id":"s1158","productId":"764","buyPrice":25.0,"sellPrice":30.48,"profit":5.48,"multi":1.22,"saleDate":"05/02/2026","receiveDate":"26/02/2026","createdAt":"2026-02-05T00:00:00.000Z"},{"id":"s1159","productId":"1271","buyPrice":16.55,"sellPrice":35.71,"profit":19.16,"multi":2.16,"saleDate":"01/02/2026","receiveDate":"27/02/2026","createdAt":"2026-02-01T00:00:00.000Z"},{"id":"s1160","productId":"510","buyPrice":16.29,"sellPrice":25.5,"profit":9.21,"multi":1.57,"saleDate":"06/02/2026","receiveDate":"27/02/2026","createdAt":"2026-02-06T00:00:00.000Z"},{"id":"s1161","productId":"32","buyPrice":14.29,"sellPrice":25.86,"profit":11.57,"multi":1.81,"saleDate":"27/01/2026","receiveDate":"27/02/2026","createdAt":"2026-01-27T00:00:00.000Z"},{"id":"s1162","productId":"94","buyPrice":7.55,"sellPrice":12.47,"profit":4.92,"multi":1.65,"saleDate":"06/02/2026","receiveDate":"27/02/2026","createdAt":"2026-02-06T00:00:00.000Z"},{"id":"s1163","productId":"1294","buyPrice":14.09,"sellPrice":39.5,"profit":25.41,"multi":2.8,"saleDate":"04/02/2026","receiveDate":"02/03/2026","createdAt":"2026-02-04T00:00:00.000Z"},{"id":"s1164","productId":"1041","buyPrice":24.7,"sellPrice":49.47,"profit":24.77,"multi":2.0,"saleDate":"06/02/2026","receiveDate":"02/03/2026","createdAt":"2026-02-06T00:00:00.000Z"},{"id":"s1165","productId":"1049","buyPrice":22.5,"sellPrice":47.25,"profit":24.75,"multi":2.1,"saleDate":"05/02/2026","receiveDate":"03/03/2026","createdAt":"2026-02-05T00:00:00.000Z"},{"id":"s1166","productId":"641","buyPrice":9.64,"sellPrice":20.48,"profit":10.84,"multi":2.12,"saleDate":"11/02/2026","receiveDate":"03/03/2026","createdAt":"2026-02-11T00:00:00.000Z"},{"id":"s1167","productId":"903","buyPrice":21.6,"sellPrice":30.52,"profit":8.92,"multi":1.41,"saleDate":"10/02/2026","receiveDate":"03/03/2026","createdAt":"2026-02-10T00:00:00.000Z"},{"id":"s1168","productId":"1330","buyPrice":15.59,"sellPrice":37.48,"profit":21.89,"multi":2.4,"saleDate":"09/02/2026","receiveDate":"03/03/2026","createdAt":"2026-02-09T00:00:00.000Z"},{"id":"s1169","productId":"1233","buyPrice":20.6,"sellPrice":45.5,"profit":24.9,"multi":2.21,"saleDate":"07/02/2026","receiveDate":"03/03/2026","createdAt":"2026-02-07T00:00:00.000Z"},{"id":"s1170","productId":"963","buyPrice":7.84,"sellPrice":15.48,"profit":7.64,"multi":1.97,"saleDate":"12/02/2026","receiveDate":"04/03/2026","createdAt":"2026-02-12T00:00:00.000Z"},{"id":"s1171","productId":"747","buyPrice":25.0,"sellPrice":35.49,"profit":10.49,"multi":1.42,"saleDate":"09/02/2026","receiveDate":"04/03/2026","createdAt":"2026-02-09T00:00:00.000Z"},{"id":"s1172","productId":"307","buyPrice":14.99,"sellPrice":27.7,"profit":12.71,"multi":1.85,"saleDate":"10/02/2026","receiveDate":"04/03/2026","createdAt":"2026-02-10T00:00:00.000Z"},{"id":"s1173","productId":"1125","buyPrice":24.51,"sellPrice":45.48,"profit":20.97,"multi":1.86,"saleDate":"13/02/2026","receiveDate":"04/03/2026","createdAt":"2026-02-13T00:00:00.000Z"},{"id":"s1174","productId":"1349","buyPrice":25.48,"sellPrice":60.49,"profit":35.01,"multi":2.37,"saleDate":"14/02/2026","receiveDate":"04/03/2026","createdAt":"2026-02-14T00:00:00.000Z"},{"id":"s1175","productId":"1337","buyPrice":18.79,"sellPrice":40.81,"profit":22.02,"multi":2.17,"saleDate":"07/02/2026","receiveDate":"04/03/2026","createdAt":"2026-02-07T00:00:00.000Z"},{"id":"s1176","productId":"1277","buyPrice":8.12,"sellPrice":15.48,"profit":7.36,"multi":1.91,"saleDate":"08/02/2026","receiveDate":"04/03/2026","createdAt":"2026-02-08T00:00:00.000Z"},{"id":"s1177","productId":"1364","buyPrice":21.9,"sellPrice":41.39,"profit":19.49,"multi":1.89,"saleDate":"14/02/2026","receiveDate":"04/03/2026","createdAt":"2026-02-14T00:00:00.000Z"},{"id":"s1178","productId":"1362","buyPrice":14.08,"sellPrice":30.5,"profit":16.42,"multi":2.17,"saleDate":"13/02/2026","receiveDate":"04/03/2026","createdAt":"2026-02-13T00:00:00.000Z"},{"id":"s1179","productId":"1336","buyPrice":24.79,"sellPrice":54.5,"profit":29.71,"multi":2.2,"saleDate":"07/02/2026","receiveDate":"04/03/2026","createdAt":"2026-02-07T00:00:00.000Z"},{"id":"s1180","productId":"1390","buyPrice":17.49,"sellPrice":49.66,"profit":32.17,"multi":2.84,"saleDate":"15/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-15T00:00:00.000Z"},{"id":"s1181","productId":"1327","buyPrice":19.73,"sellPrice":44.89,"profit":25.16,"multi":2.28,"saleDate":"07/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-07T00:00:00.000Z"},{"id":"s1182","productId":"1196","buyPrice":21.38,"sellPrice":60.47,"profit":39.09,"multi":2.83,"saleDate":"15/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-15T00:00:00.000Z"},{"id":"s1183","productId":"1318","buyPrice":27.71,"sellPrice":53.89,"profit":26.18,"multi":1.94,"saleDate":"12/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-12T00:00:00.000Z"},{"id":"s1184","productId":"1243","buyPrice":11.48,"sellPrice":30.5,"profit":19.02,"multi":2.66,"saleDate":"08/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-08T00:00:00.000Z"},{"id":"s1185","productId":"1195","buyPrice":10.62,"sellPrice":15.29,"profit":4.67,"multi":1.44,"saleDate":"12/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-12T00:00:00.000Z"},{"id":"s1186","productId":"1346","buyPrice":24.84,"sellPrice":54.52,"profit":29.68,"multi":2.19,"saleDate":"12/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-12T00:00:00.000Z"},{"id":"s1187","productId":"1383","buyPrice":11.94,"sellPrice":21.04,"profit":9.1,"multi":1.76,"saleDate":"14/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-14T00:00:00.000Z"},{"id":"s1188","productId":"1311","buyPrice":25.81,"sellPrice":55.48,"profit":29.67,"multi":2.15,"saleDate":"14/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-14T00:00:00.000Z"},{"id":"s1189","productId":"956","buyPrice":26.41,"sellPrice":30.5,"profit":4.09,"multi":1.15,"saleDate":"12/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-12T00:00:00.000Z"},{"id":"s1190","productId":"1363","buyPrice":26.87,"sellPrice":53.49,"profit":26.62,"multi":1.99,"saleDate":"13/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-13T00:00:00.000Z"},{"id":"s1191","productId":"1342","buyPrice":17.44,"sellPrice":35.47,"profit":18.03,"multi":2.03,"saleDate":"07/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-07T00:00:00.000Z"},{"id":"s1192","productId":"1139","buyPrice":32.2,"sellPrice":40.71,"profit":8.51,"multi":1.26,"saleDate":"11/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-11T00:00:00.000Z"},{"id":"s1193","productId":"877","buyPrice":8.6,"sellPrice":19.81,"profit":11.21,"multi":2.3,"saleDate":"14/02/2026","receiveDate":"05/03/2026","createdAt":"2026-02-14T00:00:00.000Z"},{"id":"s1194","productId":"691","buyPrice":6.35,"sellPrice":21.49,"profit":15.14,"multi":3.38,"saleDate":"07/02/2026","receiveDate":"06/03/2026","createdAt":"2026-02-07T00:00:00.000Z"},{"id":"s1195","productId":"1373","buyPrice":13.69,"sellPrice":43.49,"profit":29.8,"multi":3.18,"saleDate":"14/02/2026","receiveDate":"06/03/2026","createdAt":"2026-02-14T00:00:00.000Z"},{"id":"s1196","productId":"1295","buyPrice":7.5,"sellPrice":15.48,"profit":7.98,"multi":2.06,"saleDate":"14/02/2026","receiveDate":"06/03/2026","createdAt":"2026-02-14T00:00:00.000Z"},{"id":"s1197","productId":"760+1324","buyPrice":35.0,"sellPrice":75.52,"profit":40.52,"multi":2.16,"saleDate":"13/02/2026","receiveDate":"06/03/2026","createdAt":"2026-02-13T00:00:00.000Z"},{"id":"s1198","productId":"1393","buyPrice":15.33,"sellPrice":32.48,"profit":17.15,"multi":2.12,"saleDate":"15/02/2026","receiveDate":"06/03/2026","createdAt":"2026-02-15T00:00:00.000Z"},{"id":"s1199","productId":"1351","buyPrice":10.79,"sellPrice":25.71,"profit":14.92,"multi":2.38,"saleDate":"12/02/2026","receiveDate":"06/03/2026","createdAt":"2026-02-12T00:00:00.000Z"},{"id":"s1200","productId":"1389","buyPrice":15.6,"sellPrice":47.73,"profit":32.13,"multi":3.06,"saleDate":"14/02/2026","receiveDate":"06/03/2026","createdAt":"2026-02-14T00:00:00.000Z"},{"id":"s1201","productId":"1379","buyPrice":14.5,"sellPrice":58.54,"profit":44.04,"multi":4.04,"saleDate":"14/02/2026","receiveDate":"06/03/2026","createdAt":"2026-02-14T00:00:00.000Z"},{"id":"s1202","productId":"1388","buyPrice":15.55,"sellPrice":34.03,"profit":18.48,"multi":2.19,"saleDate":"14/02/2026","receiveDate":"06/03/2026","createdAt":"2026-02-14T00:00:00.000Z"},{"id":"s1203","productId":"1355 et 1384","buyPrice":44.0,"sellPrice":125.71,"profit":81.71,"multi":2.86,"saleDate":"15/02/2026","receiveDate":"09/03/2026","createdAt":"2026-02-15T00:00:00.000Z"},{"id":"s1204","productId":"1245","buyPrice":16.45,"sellPrice":45.2,"profit":28.75,"multi":2.75,"saleDate":"16/02/2026","receiveDate":"09/03/2026","createdAt":"2026-02-16T00:00:00.000Z"},{"id":"s1205","productId":"569","buyPrice":61.06,"sellPrice":50.5,"profit":-10.56,"multi":0.83,"saleDate":"01/02/2026","receiveDate":"09/03/2026","createdAt":"2026-02-01T00:00:00.000Z"},{"id":"s1206","productId":"1382","buyPrice":19.54,"sellPrice":45.48,"profit":25.94,"multi":2.33,"saleDate":"16/02/2026","receiveDate":"09/03/2026","createdAt":"2026-02-16T00:00:00.000Z"},{"id":"s1207","productId":"547","buyPrice":9.84,"sellPrice":25.49,"profit":15.65,"multi":2.59,"saleDate":"15/02/2026","receiveDate":"09/03/2026","createdAt":"2026-02-15T00:00:00.000Z"},{"id":"s1208","productId":"1307","buyPrice":25.59,"sellPrice":51.8,"profit":26.21,"multi":2.02,"saleDate":"16/02/2026","receiveDate":"09/03/2026","createdAt":"2026-02-16T00:00:00.000Z"},{"id":"s1209","productId":"1044","buyPrice":20.0,"sellPrice":30.48,"profit":10.48,"multi":1.52,"saleDate":"16/02/2026","receiveDate":"09/03/2026","createdAt":"2026-02-16T00:00:00.000Z"},{"id":"s1210","productId":"1325","buyPrice":22.21,"sellPrice":45.49,"profit":23.28,"multi":2.05,"saleDate":"07/02/2026","receiveDate":"09/03/2026","createdAt":"2026-02-07T00:00:00.000Z"},{"id":"s1211","productId":"1394","buyPrice":17.49,"sellPrice":48.48,"profit":30.99,"multi":2.77,"saleDate":"15/02/2026","receiveDate":"09/03/2026","createdAt":"2026-02-15T00:00:00.000Z"},{"id":"s1212","productId":"1322","buyPrice":19.19,"sellPrice":38.7,"profit":19.51,"multi":2.02,"saleDate":"07/02/2026","receiveDate":"09/03/2026","createdAt":"2026-02-07T00:00:00.000Z"},{"id":"s1213","productId":"987","buyPrice":24.7,"sellPrice":45.71,"profit":21.01,"multi":1.85,"saleDate":"13/02/2026","receiveDate":"09/03/2026","createdAt":"2026-02-13T00:00:00.000Z"},{"id":"s1214","productId":"1392","buyPrice":21.57,"sellPrice":45.5,"profit":23.93,"multi":2.11,"saleDate":"16/02/2026","receiveDate":"10/03/2026","createdAt":"2026-02-16T00:00:00.000Z"},{"id":"s1215","productId":"102","buyPrice":14.89,"sellPrice":19.47,"profit":4.58,"multi":1.31,"saleDate":"18/02/2026","receiveDate":"11/03/2026","createdAt":"2026-02-18T00:00:00.000Z"},{"id":"s1216","productId":"Lot 3 article 1386","buyPrice":40.83,"sellPrice":100.73,"profit":59.9,"multi":2.47,"saleDate":"19/02/2026","receiveDate":"11/03/2026","createdAt":"2026-02-19T00:00:00.000Z"},{"id":"s1217","productId":"139","buyPrice":25.81,"sellPrice":20.81,"profit":-5.0,"multi":0.81,"saleDate":"20/02/2026","receiveDate":"11/03/2026","createdAt":"2026-02-20T00:00:00.000Z"},{"id":"s1218","productId":"1237","buyPrice":24.0,"sellPrice":40.5,"profit":16.5,"multi":1.69,"saleDate":"19/02/2026","receiveDate":"11/03/2026","createdAt":"2026-02-19T00:00:00.000Z"},{"id":"s1219","productId":"1241","buyPrice":24.41,"sellPrice":40.99,"profit":16.58,"multi":1.68,"saleDate":"20/02/2026","receiveDate":"11/03/2026","createdAt":"2026-02-20T00:00:00.000Z"},{"id":"s1220","productId":"487","buyPrice":14.04,"sellPrice":14.5,"profit":0.46,"multi":1.03,"saleDate":"19/02/2026","receiveDate":"11/03/2026","createdAt":"2026-02-19T00:00:00.000Z"},{"id":"s1221","productId":"1228","buyPrice":21.0,"sellPrice":50.0,"profit":29.0,"multi":2.38,"saleDate":"18/02/2026","receiveDate":"11/03/2026","createdAt":"2026-02-18T00:00:00.000Z"},{"id":"s1222","productId":"Lot 2 articles 782","buyPrice":36.67,"sellPrice":61.79,"profit":25.12,"multi":1.69,"saleDate":"20/02/2026","receiveDate":"11/03/2026","createdAt":"2026-02-20T00:00:00.000Z"},{"id":"s1223","productId":"1160","buyPrice":25.21,"sellPrice":44.5,"profit":19.29,"multi":1.77,"saleDate":"20/02/2026","receiveDate":"11/03/2026","createdAt":"2026-02-20T00:00:00.000Z"},{"id":"s1224","productId":"809","buyPrice":25.0,"sellPrice":46.08,"profit":21.08,"multi":1.84,"saleDate":"19/02/2026","receiveDate":"11/03/2026","createdAt":"2026-02-19T00:00:00.000Z"},{"id":"s1225","productId":"223","buyPrice":18.74,"sellPrice":30.0,"profit":11.26,"multi":1.6,"saleDate":"20/02/2026","receiveDate":"11/03/2026","createdAt":"2026-02-20T00:00:00.000Z"},{"id":"s1226","productId":"143","buyPrice":8.78,"sellPrice":22.48,"profit":13.7,"multi":2.56,"saleDate":"19/02/2026","receiveDate":"11/03/2026","createdAt":"2026-02-19T00:00:00.000Z"},{"id":"s1227","productId":"1279","buyPrice":9.92,"sellPrice":20.5,"profit":10.58,"multi":2.07,"saleDate":"17/02/2026","receiveDate":"11/03/2026","createdAt":"2026-02-17T00:00:00.000Z"},{"id":"s1228","productId":"386","buyPrice":14.19,"sellPrice":20.5,"profit":6.31,"multi":1.44,"saleDate":"21/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-21T00:00:00.000Z"},{"id":"s1229","productId":"1398","buyPrice":19.78,"sellPrice":50.71,"profit":30.93,"multi":2.56,"saleDate":"19/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-19T00:00:00.000Z"},{"id":"s1230","productId":"1380","buyPrice":14.48,"sellPrice":49.29,"profit":34.81,"multi":3.4,"saleDate":"17/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-17T00:00:00.000Z"},{"id":"s1231","productId":"1174","buyPrice":11.5,"sellPrice":26.48,"profit":14.98,"multi":2.3,"saleDate":"18/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-18T00:00:00.000Z"},{"id":"s1232","productId":"1293","buyPrice":26.85,"sellPrice":49.53,"profit":22.68,"multi":1.84,"saleDate":"17/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-17T00:00:00.000Z"},{"id":"s1233","productId":"587","buyPrice":23.49,"sellPrice":50.71,"profit":27.22,"multi":2.16,"saleDate":"19/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-19T00:00:00.000Z"},{"id":"s1234","productId":"1350","buyPrice":22.88,"sellPrice":46.98,"profit":24.1,"multi":2.05,"saleDate":"22/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-22T00:00:00.000Z"},{"id":"s1235","productId":"1013","buyPrice":21.6,"sellPrice":30.99,"profit":9.39,"multi":1.43,"saleDate":"21/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-21T00:00:00.000Z"},{"id":"s1236","productId":"840","buyPrice":8.88,"sellPrice":22.71,"profit":13.83,"multi":2.56,"saleDate":"19/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-19T00:00:00.000Z"},{"id":"s1237","productId":"761","buyPrice":25.81,"sellPrice":32.98,"profit":7.17,"multi":1.28,"saleDate":"20/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-20T00:00:00.000Z"},{"id":"s1238","productId":"725","buyPrice":26.92,"sellPrice":40.48,"profit":13.56,"multi":1.5,"saleDate":"21/01/2026","receiveDate":"12/03/2026","createdAt":"2026-01-21T00:00:00.000Z"},{"id":"s1239","productId":"1004","buyPrice":24.0,"sellPrice":40.22,"profit":16.22,"multi":1.68,"saleDate":"14/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-14T00:00:00.000Z"},{"id":"s1240","productId":"1272","buyPrice":14.09,"sellPrice":42.0,"profit":27.91,"multi":2.98,"saleDate":"23/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-23T00:00:00.000Z"},{"id":"s1241","productId":"1374","buyPrice":26.05,"sellPrice":63.7,"profit":37.65,"multi":2.45,"saleDate":"16/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-16T00:00:00.000Z"},{"id":"s1242","productId":"1234","buyPrice":23.0,"sellPrice":45.89,"profit":22.89,"multi":2.0,"saleDate":"22/02/2026","receiveDate":"12/03/2026","createdAt":"2026-02-22T00:00:00.000Z"},{"id":"s1243","productId":"111","buyPrice":14.855,"sellPrice":32.81,"profit":17.96,"multi":2.21,"saleDate":"05/03/2026","receiveDate":"12/03/2026","createdAt":"2026-03-05T00:00:00.000Z"},{"id":"s1244","productId":"28","buyPrice":12.0,"sellPrice":15.71,"profit":3.71,"multi":1.31,"saleDate":"18/02/2026","receiveDate":"13/03/2026","createdAt":"2026-02-18T00:00:00.000Z"},{"id":"s1245","productId":"1073","buyPrice":15.0,"sellPrice":30.48,"profit":15.48,"multi":2.03,"saleDate":"23/02/2026","receiveDate":"13/03/2026","createdAt":"2026-02-23T00:00:00.000Z"},{"id":"s1246","productId":"1347","buyPrice":21.9,"sellPrice":49.54,"profit":27.64,"multi":2.26,"saleDate":"22/02/2026","receiveDate":"13/03/2026","createdAt":"2026-02-22T00:00:00.000Z"},{"id":"s1247","productId":"800","buyPrice":20.0,"sellPrice":26.53,"profit":6.53,"multi":1.33,"saleDate":"20/02/2026","receiveDate":"13/03/2026","createdAt":"2026-02-20T00:00:00.000Z"},{"id":"s1248","productId":"1172","buyPrice":11.5,"sellPrice":25.71,"profit":14.21,"multi":2.24,"saleDate":"23/02/2026","receiveDate":"13/03/2026","createdAt":"2026-02-23T00:00:00.000Z"},{"id":"s1249","productId":"1391","buyPrice":10.79,"sellPrice":28.73,"profit":17.94,"multi":2.66,"saleDate":"16/02/2026","receiveDate":"13/03/2026","createdAt":"2026-02-16T00:00:00.000Z"},{"id":"s1250","productId":"1269","buyPrice":27.89,"sellPrice":50.71,"profit":22.82,"multi":1.82,"saleDate":"21/02/2026","receiveDate":"13/03/2026","createdAt":"2026-02-21T00:00:00.000Z"},{"id":"s1251","productId":"1352","buyPrice":16.69,"sellPrice":39.2,"profit":22.51,"multi":2.35,"saleDate":"22/02/2026","receiveDate":"13/03/2026","createdAt":"2026-02-22T00:00:00.000Z"},{"id":"s1252","productId":"1368","buyPrice":10.81,"sellPrice":26.48,"profit":15.67,"multi":2.45,"saleDate":"22/02/2026","receiveDate":"13/03/2026","createdAt":"2026-02-22T00:00:00.000Z"},{"id":"s1253","productId":"561","buyPrice":18.09,"sellPrice":30.47,"profit":12.38,"multi":1.68,"saleDate":"23/02/2026","receiveDate":"13/03/2026","createdAt":"2026-02-23T00:00:00.000Z"},{"id":"s1254","productId":"1115","buyPrice":16.49,"sellPrice":40.4,"profit":23.91,"multi":2.45,"saleDate":"21/02/2026","receiveDate":"13/03/2026","createdAt":"2026-02-21T00:00:00.000Z"},{"id":"s1255","productId":"1324","buyPrice":10.0,"sellPrice":55.5,"profit":45.5,"multi":5.55,"saleDate":"23/02/2026","receiveDate":"13/03/2026","createdAt":"2026-02-23T00:00:00.000Z"},{"id":"s1256","productId":"1407","buyPrice":19.54,"sellPrice":60.47,"profit":40.93,"multi":3.09,"saleDate":"25/02/2026","receiveDate":"16/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1257","productId":"1344","buyPrice":14.1,"sellPrice":30.5,"profit":16.4,"multi":2.16,"saleDate":"23/02/2026","receiveDate":"16/03/2026","createdAt":"2026-02-23T00:00:00.000Z"},{"id":"s1258","productId":"1261","buyPrice":8.0,"sellPrice":19.54,"profit":11.54,"multi":2.44,"saleDate":"23/02/2026","receiveDate":"16/03/2026","createdAt":"2026-02-23T00:00:00.000Z"},{"id":"s1259","productId":"1357","buyPrice":14.48,"sellPrice":30.54,"profit":16.06,"multi":2.11,"saleDate":"19/02/2026","receiveDate":"16/03/2026","createdAt":"2026-02-19T00:00:00.000Z"},{"id":"s1260","productId":"1423","buyPrice":14.0,"sellPrice":37.49,"profit":23.49,"multi":2.68,"saleDate":"25/02/2026","receiveDate":"16/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1261","productId":"1164","buyPrice":14.09,"sellPrice":53.47,"profit":39.38,"multi":3.79,"saleDate":"22/02/2026","receiveDate":"16/03/2026","createdAt":"2026-02-22T00:00:00.000Z"},{"id":"s1262","productId":"1372","buyPrice":23.99,"sellPrice":45.48,"profit":21.49,"multi":1.9,"saleDate":"25/02/2026","receiveDate":"16/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1263","productId":"396","buyPrice":11.84,"sellPrice":23.7,"profit":11.86,"multi":2.0,"saleDate":"23/02/2026","receiveDate":"16/03/2026","createdAt":"2026-02-23T00:00:00.000Z"},{"id":"s1264","productId":"1056","buyPrice":24.51,"sellPrice":48.2,"profit":23.69,"multi":1.97,"saleDate":"22/02/2026","receiveDate":"16/03/2026","createdAt":"2026-02-22T00:00:00.000Z"},{"id":"s1265","productId":"71","buyPrice":16.21,"sellPrice":21.71,"profit":5.5,"multi":1.34,"saleDate":"20/02/2026","receiveDate":"16/03/2026","createdAt":"2026-02-20T00:00:00.000Z"},{"id":"s1266","productId":"700","buyPrice":31.01,"sellPrice":50.5,"profit":19.49,"multi":1.63,"saleDate":"25/02/2026","receiveDate":"16/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1267","productId":"1214","buyPrice":19.33,"sellPrice":49.48,"profit":30.15,"multi":2.56,"saleDate":"18/02/2026","receiveDate":"16/03/2026","createdAt":"2026-02-18T00:00:00.000Z"},{"id":"s1268","productId":"1405","buyPrice":22.11,"sellPrice":47.72,"profit":25.61,"multi":2.16,"saleDate":"27/02/2026","receiveDate":"17/03/2026","createdAt":"2026-02-27T00:00:00.000Z"},{"id":"s1269","productId":"1353","buyPrice":24.44,"sellPrice":69.71,"profit":45.27,"multi":2.85,"saleDate":"01/03/2026","receiveDate":"17/03/2026","createdAt":"2026-03-01T00:00:00.000Z"},{"id":"s1270","productId":"1326","buyPrice":14.09,"sellPrice":36.72,"profit":22.63,"multi":2.61,"saleDate":"27/02/2026","receiveDate":"17/03/2026","createdAt":"2026-02-27T00:00:00.000Z"},{"id":"s1271","productId":"1064","buyPrice":45.0,"sellPrice":60.71,"profit":15.71,"multi":1.35,"saleDate":"22/02/2026","receiveDate":"17/03/2026","createdAt":"2026-02-22T00:00:00.000Z"},{"id":"s1272","productId":"1420","buyPrice":14.08,"sellPrice":35.6,"profit":21.52,"multi":2.53,"saleDate":"25/02/2026","receiveDate":"17/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1273","productId":"1396","buyPrice":15.59,"sellPrice":30.89,"profit":15.3,"multi":1.98,"saleDate":"24/02/2026","receiveDate":"17/03/2026","createdAt":"2026-02-24T00:00:00.000Z"},{"id":"s1274","productId":"1306","buyPrice":15.39,"sellPrice":40.49,"profit":25.1,"multi":2.63,"saleDate":"24/02/2026","receiveDate":"17/03/2026","createdAt":"2026-02-24T00:00:00.000Z"},{"id":"s1275","productId":"1258","buyPrice":12.95,"sellPrice":24.5,"profit":11.55,"multi":1.89,"saleDate":"23/02/2026","receiveDate":"17/03/2026","createdAt":"2026-02-23T00:00:00.000Z"},{"id":"s1276","productId":"1034","buyPrice":24.84,"sellPrice":39.99,"profit":15.15,"multi":1.61,"saleDate":"24/02/2026","receiveDate":"17/03/2026","createdAt":"2026-02-24T00:00:00.000Z"},{"id":"s1277","productId":"1409","buyPrice":8.65,"sellPrice":25.89,"profit":17.24,"multi":2.99,"saleDate":"25/02/2026","receiveDate":"17/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1278","productId":"960","buyPrice":19.3,"sellPrice":42.47,"profit":23.17,"multi":2.2,"saleDate":"22/02/2026","receiveDate":"17/03/2026","createdAt":"2026-02-22T00:00:00.000Z"},{"id":"s1279","productId":"1416","buyPrice":22.42,"sellPrice":53.5,"profit":31.08,"multi":2.39,"saleDate":"25/02/2026","receiveDate":"17/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1280","productId":"1186","buyPrice":26.95,"sellPrice":50.86,"profit":23.91,"multi":1.89,"saleDate":"23/02/2026","receiveDate":"17/03/2026","createdAt":"2026-02-23T00:00:00.000Z"},{"id":"s1281","productId":"1236+1026","buyPrice":48.0,"sellPrice":90.63,"profit":42.63,"multi":1.89,"saleDate":"25/02/2026","receiveDate":"17/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1282","productId":"1434","buyPrice":17.0,"sellPrice":39.86,"profit":22.86,"multi":2.34,"saleDate":"25/02/2026","receiveDate":"18/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1283","productId":"1414","buyPrice":14.99,"sellPrice":36.54,"profit":21.55,"multi":2.44,"saleDate":"25/02/2026","receiveDate":"18/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1284","productId":"902","buyPrice":12.81,"sellPrice":40.53,"profit":27.72,"multi":3.16,"saleDate":"24/02/2026","receiveDate":"18/03/2026","createdAt":"2026-02-24T00:00:00.000Z"},{"id":"s1285","productId":"1110","buyPrice":20.0,"sellPrice":35.71,"profit":15.71,"multi":1.79,"saleDate":"26/02/2026","receiveDate":"18/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1286","productId":"1358","buyPrice":14.29,"sellPrice":44.24,"profit":29.95,"multi":3.1,"saleDate":"17/02/2026","receiveDate":"18/03/2026","createdAt":"2026-02-17T00:00:00.000Z"},{"id":"s1287","productId":"1365","buyPrice":29.41,"sellPrice":67.49,"profit":38.08,"multi":2.29,"saleDate":"24/02/2026","receiveDate":"18/03/2026","createdAt":"2026-02-24T00:00:00.000Z"},{"id":"s1288","productId":"1221","buyPrice":19.99,"sellPrice":45.81,"profit":25.82,"multi":2.29,"saleDate":"23/02/2026","receiveDate":"18/03/2026","createdAt":"2026-02-23T00:00:00.000Z"},{"id":"s1289","productId":"1427","buyPrice":17.9,"sellPrice":49.47,"profit":31.57,"multi":2.76,"saleDate":"26/02/2026","receiveDate":"18/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1290","productId":"1037","buyPrice":19.39,"sellPrice":25.89,"profit":6.5,"multi":1.34,"saleDate":"21/02/2026","receiveDate":"18/03/2026","createdAt":"2026-02-21T00:00:00.000Z"},{"id":"s1291","productId":"1467","buyPrice":10.84,"sellPrice":30.71,"profit":19.87,"multi":2.83,"saleDate":"02/03/2026","receiveDate":"19/03/2026","createdAt":"2026-03-02T00:00:00.000Z"},{"id":"s1292","productId":"1453","buyPrice":15.0,"sellPrice":65.48,"profit":50.48,"multi":4.37,"saleDate":"01/03/2026","receiveDate":"19/03/2026","createdAt":"2026-03-01T00:00:00.000Z"},{"id":"s1293","productId":"1292","buyPrice":9.22,"sellPrice":20.86,"profit":11.64,"multi":2.26,"saleDate":"24/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-24T00:00:00.000Z"},{"id":"s1294","productId":"881","buyPrice":20.0,"sellPrice":14.48,"profit":-5.52,"multi":0.72,"saleDate":"01/03/2026","receiveDate":"19/03/2026","createdAt":"2026-03-01T00:00:00.000Z"},{"id":"s1295","productId":"1060","buyPrice":13.88,"sellPrice":28.89,"profit":15.01,"multi":2.08,"saleDate":"25/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1296","productId":"1430","buyPrice":19.33,"sellPrice":40.89,"profit":21.56,"multi":2.12,"saleDate":"26/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1297","productId":"1443","buyPrice":9.07,"sellPrice":25.48,"profit":16.41,"multi":2.81,"saleDate":"26/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1298","productId":"1161","buyPrice":25.48,"sellPrice":55.48,"profit":30.0,"multi":2.18,"saleDate":"28/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1299","productId":"1042","buyPrice":24.7,"sellPrice":45.5,"profit":20.8,"multi":1.84,"saleDate":"27/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-27T00:00:00.000Z"},{"id":"s1300","productId":"1173","buyPrice":11.5,"sellPrice":23.5,"profit":12.0,"multi":2.04,"saleDate":"26/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1301","productId":"1072","buyPrice":24.7,"sellPrice":45.99,"profit":21.29,"multi":1.86,"saleDate":"27/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-27T00:00:00.000Z"},{"id":"s1302","productId":"758","buyPrice":19.3,"sellPrice":32.99,"profit":13.69,"multi":1.71,"saleDate":"28/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1303","productId":"1449","buyPrice":27.42,"sellPrice":52.5,"profit":25.08,"multi":1.91,"saleDate":"28/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1304","productId":"1068","buyPrice":22.21,"sellPrice":34.5,"profit":12.29,"multi":1.55,"saleDate":"26/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1305","productId":"1452","buyPrice":23.49,"sellPrice":45.48,"profit":21.99,"multi":1.94,"saleDate":"27/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-27T00:00:00.000Z"},{"id":"s1306","productId":"1315+885","buyPrice":47.0,"sellPrice":75.41,"profit":28.41,"multi":1.6,"saleDate":"26/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1307","productId":"1341","buyPrice":19.54,"sellPrice":44.53,"profit":24.99,"multi":2.28,"saleDate":"23/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-23T00:00:00.000Z"},{"id":"s1308","productId":"856","buyPrice":24.7,"sellPrice":47.3,"profit":22.6,"multi":1.91,"saleDate":"28/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1309","productId":"393","buyPrice":15.39,"sellPrice":30.89,"profit":15.5,"multi":2.01,"saleDate":"27/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-27T00:00:00.000Z"},{"id":"s1310","productId":"1445","buyPrice":16.49,"sellPrice":43.48,"profit":26.99,"multi":2.64,"saleDate":"01/03/2026","receiveDate":"19/03/2026","createdAt":"2026-03-01T00:00:00.000Z"},{"id":"s1311","productId":"1440","buyPrice":15.65,"sellPrice":50.48,"profit":34.83,"multi":3.23,"saleDate":"26/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1312","productId":"1418","buyPrice":11.0,"sellPrice":20.73,"profit":9.73,"multi":1.88,"saleDate":"25/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1313","productId":"1331","buyPrice":20.24,"sellPrice":40.48,"profit":20.24,"multi":2.0,"saleDate":"26/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1314","productId":"1441","buyPrice":14.28,"sellPrice":30.54,"profit":16.26,"multi":2.14,"saleDate":"26/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1315","productId":"892","buyPrice":20.6,"sellPrice":45.5,"profit":24.9,"multi":2.21,"saleDate":"26/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1316","productId":"1045","buyPrice":24.51,"sellPrice":44.49,"profit":19.98,"multi":1.82,"saleDate":"28/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1317","productId":"1461","buyPrice":20.12,"sellPrice":49.48,"profit":29.36,"multi":2.46,"saleDate":"02/03/2026","receiveDate":"19/03/2026","createdAt":"2026-03-02T00:00:00.000Z"},{"id":"s1318","productId":"1401","buyPrice":15.85,"sellPrice":40.71,"profit":24.86,"multi":2.57,"saleDate":"25/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1319","productId":"1417","buyPrice":15.59,"sellPrice":40.89,"profit":25.3,"multi":2.62,"saleDate":"01/03/2026","receiveDate":"19/03/2026","createdAt":"2026-03-01T00:00:00.000Z"},{"id":"s1320","productId":"1422","buyPrice":14.0,"sellPrice":47.48,"profit":33.48,"multi":3.39,"saleDate":"28/02/2026","receiveDate":"19/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1321","productId":"1074","buyPrice":15.83,"sellPrice":24.5,"profit":8.67,"multi":1.55,"saleDate":"28/02/2026","receiveDate":"20/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1322","productId":"1098","buyPrice":17.47,"sellPrice":30.48,"profit":13.01,"multi":1.74,"saleDate":"26/02/2026","receiveDate":"20/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1323","productId":"1019","buyPrice":16.36,"sellPrice":35.86,"profit":19.5,"multi":2.19,"saleDate":"01/03/2026","receiveDate":"20/03/2026","createdAt":"2026-03-01T00:00:00.000Z"},{"id":"s1324","productId":"685","buyPrice":22.31,"sellPrice":41.91,"profit":19.6,"multi":1.88,"saleDate":"02/03/2026","receiveDate":"20/03/2026","createdAt":"2026-03-02T00:00:00.000Z"},{"id":"s1325","productId":"353","buyPrice":15.79,"sellPrice":27.5,"profit":11.71,"multi":1.74,"saleDate":"25/02/2026","receiveDate":"20/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1326","productId":"1403","buyPrice":14.99,"sellPrice":30.89,"profit":15.9,"multi":2.06,"saleDate":"25/02/2026","receiveDate":"20/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1327","productId":"1424","buyPrice":14.79,"sellPrice":45.5,"profit":30.71,"multi":3.08,"saleDate":"25/02/2026","receiveDate":"20/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1328","productId":"613","buyPrice":19.2,"sellPrice":39.5,"profit":20.3,"multi":2.06,"saleDate":"26/02/2026","receiveDate":"20/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1329","productId":"1451","buyPrice":15.39,"sellPrice":40.53,"profit":25.14,"multi":2.63,"saleDate":"26/02/2026","receiveDate":"20/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1330","productId":"1446","buyPrice":18.79,"sellPrice":45.5,"profit":26.71,"multi":2.42,"saleDate":"27/02/2026","receiveDate":"20/03/2026","createdAt":"2026-02-27T00:00:00.000Z"},{"id":"s1331","productId":"1257","buyPrice":23.74,"sellPrice":50.68,"profit":26.94,"multi":2.13,"saleDate":"23/02/2026","receiveDate":"20/03/2026","createdAt":"2026-02-23T00:00:00.000Z"},{"id":"s1332","productId":"1483","buyPrice":12.89,"sellPrice":44.72,"profit":31.83,"multi":3.47,"saleDate":"09/03/2026","receiveDate":"22/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1333","productId":"1227","buyPrice":16.59,"sellPrice":24.48,"profit":7.89,"multi":1.48,"saleDate":"28/02/2026","receiveDate":"23/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1334","productId":"1465","buyPrice":16.45,"sellPrice":38.5,"profit":22.05,"multi":2.34,"saleDate":"01/03/2026","receiveDate":"23/03/2026","createdAt":"2026-03-01T00:00:00.000Z"},{"id":"s1335","productId":"1457","buyPrice":24.42,"sellPrice":57.5,"profit":33.08,"multi":2.35,"saleDate":"26/02/2026","receiveDate":"23/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1336","productId":"1406","buyPrice":19.44,"sellPrice":49.67,"profit":30.23,"multi":2.56,"saleDate":"02/03/2026","receiveDate":"23/03/2026","createdAt":"2026-03-02T00:00:00.000Z"},{"id":"s1337","productId":"1385","buyPrice":18.35,"sellPrice":50.53,"profit":32.18,"multi":2.75,"saleDate":"28/02/2026","receiveDate":"23/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1338","productId":"1469","buyPrice":9.74,"sellPrice":26.5,"profit":16.76,"multi":2.72,"saleDate":"03/03/2026","receiveDate":"23/03/2026","createdAt":"2026-03-03T00:00:00.000Z"},{"id":"s1339","productId":"1426","buyPrice":8.93,"sellPrice":30.5,"profit":21.57,"multi":3.42,"saleDate":"26/02/2026","receiveDate":"23/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1340","productId":"710","buyPrice":24.7,"sellPrice":40.48,"profit":15.78,"multi":1.64,"saleDate":"02/03/2026","receiveDate":"23/03/2026","createdAt":"2026-03-02T00:00:00.000Z"},{"id":"s1341","productId":"148","buyPrice":14.09,"sellPrice":20.49,"profit":6.4,"multi":1.45,"saleDate":"03/03/2026","receiveDate":"23/03/2026","createdAt":"2026-03-03T00:00:00.000Z"},{"id":"s1342","productId":"1450","buyPrice":20.24,"sellPrice":44.5,"profit":24.26,"multi":2.2,"saleDate":"02/03/2026","receiveDate":"23/03/2026","createdAt":"2026-03-02T00:00:00.000Z"},{"id":"s1343","productId":"1369","buyPrice":20.0,"sellPrice":40.53,"profit":20.53,"multi":2.03,"saleDate":"26/02/2026","receiveDate":"23/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1344","productId":"1448","buyPrice":21.9,"sellPrice":52.68,"profit":30.78,"multi":2.41,"saleDate":"04/03/2026","receiveDate":"23/03/2026","createdAt":"2026-03-04T00:00:00.000Z"},{"id":"s1345","productId":"1106+1464","buyPrice":43.0,"sellPrice":75.73,"profit":32.73,"multi":1.76,"saleDate":"04/03/2026","receiveDate":"23/03/2026","createdAt":"2026-03-04T00:00:00.000Z"},{"id":"s1346","productId":"1433","buyPrice":16.36,"sellPrice":40.99,"profit":24.63,"multi":2.51,"saleDate":"03/03/2026","receiveDate":"23/03/2026","createdAt":"2026-03-03T00:00:00.000Z"},{"id":"s1347","productId":"1404","buyPrice":25.31,"sellPrice":50.5,"profit":25.19,"multi":2.0,"saleDate":"25/02/2026","receiveDate":"23/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1348","productId":"1338","buyPrice":9.88,"sellPrice":28.49,"profit":18.61,"multi":2.88,"saleDate":"03/03/2026","receiveDate":"23/03/2026","createdAt":"2026-03-03T00:00:00.000Z"},{"id":"s1349","productId":"1460","buyPrice":19.3,"sellPrice":47.5,"profit":28.2,"multi":2.46,"saleDate":"01/03/2026","receiveDate":"23/03/2026","createdAt":"2026-03-01T00:00:00.000Z"},{"id":"s1350","productId":"1456","buyPrice":16.0,"sellPrice":38.71,"profit":22.71,"multi":2.42,"saleDate":"01/03/2026","receiveDate":"23/03/2026","createdAt":"2026-03-01T00:00:00.000Z"},{"id":"s1351","productId":"1462","buyPrice":15.39,"sellPrice":35.48,"profit":20.09,"multi":2.31,"saleDate":"04/03/2026","receiveDate":"23/03/2026","createdAt":"2026-03-04T00:00:00.000Z"},{"id":"s1352","productId":"882","buyPrice":20.0,"sellPrice":35.73,"profit":15.73,"multi":1.79,"saleDate":"28/02/2026","receiveDate":"23/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1353","productId":"1411","buyPrice":11.0,"sellPrice":41.21,"profit":30.21,"multi":3.75,"saleDate":"27/02/2026","receiveDate":"24/03/2026","createdAt":"2026-02-27T00:00:00.000Z"},{"id":"s1354","productId":"1511","buyPrice":15.0,"sellPrice":39.48,"profit":24.48,"multi":2.63,"saleDate":"06/03/2026","receiveDate":"24/03/2026","createdAt":"2026-03-06T00:00:00.000Z"},{"id":"s1355","productId":"1028","buyPrice":25.31,"sellPrice":45.71,"profit":20.4,"multi":1.81,"saleDate":"28/02/2026","receiveDate":"24/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1356","productId":"1238","buyPrice":13.32,"sellPrice":40.5,"profit":27.18,"multi":3.04,"saleDate":"01/03/2026","receiveDate":"24/03/2026","createdAt":"2026-03-01T00:00:00.000Z"},{"id":"s1357","productId":"1356","buyPrice":23.49,"sellPrice":45.71,"profit":22.22,"multi":1.95,"saleDate":"02/03/2026","receiveDate":"25/03/2026","createdAt":"2026-03-02T00:00:00.000Z"},{"id":"s1358","productId":"1488","buyPrice":16.87,"sellPrice":40.48,"profit":23.61,"multi":2.4,"saleDate":"05/03/2026","receiveDate":"25/03/2026","createdAt":"2026-03-05T00:00:00.000Z"},{"id":"s1359","productId":"1273","buyPrice":12.56,"sellPrice":20.71,"profit":8.15,"multi":1.65,"saleDate":"04/03/2026","receiveDate":"25/03/2026","createdAt":"2026-03-04T00:00:00.000Z"},{"id":"s1360","productId":"1289","buyPrice":6.08,"sellPrice":29.49,"profit":23.41,"multi":4.85,"saleDate":"27/02/2026","receiveDate":"25/03/2026","createdAt":"2026-02-27T00:00:00.000Z"},{"id":"s1361","productId":"1490","buyPrice":17.29,"sellPrice":42.36,"profit":25.07,"multi":2.45,"saleDate":"05/03/2026","receiveDate":"25/03/2026","createdAt":"2026-03-05T00:00:00.000Z"},{"id":"s1362","productId":"1484","buyPrice":15.0,"sellPrice":50.55,"profit":35.55,"multi":3.37,"saleDate":"05/03/2026","receiveDate":"25/03/2026","createdAt":"2026-03-05T00:00:00.000Z"},{"id":"s1363","productId":"1339","buyPrice":19.33,"sellPrice":45.5,"profit":26.17,"multi":2.35,"saleDate":"04/03/2026","receiveDate":"25/03/2026","createdAt":"2026-03-04T00:00:00.000Z"},{"id":"s1364","productId":"1088","buyPrice":18.0,"sellPrice":29.5,"profit":11.5,"multi":1.64,"saleDate":"25/02/2026","receiveDate":"25/03/2026","createdAt":"2026-02-25T00:00:00.000Z"},{"id":"s1365","productId":"1429","buyPrice":15.96,"sellPrice":48.41,"profit":32.45,"multi":3.03,"saleDate":"28/02/2026","receiveDate":"25/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1366","productId":"1320","buyPrice":19.49,"sellPrice":40.71,"profit":21.22,"multi":2.09,"saleDate":"03/03/2026","receiveDate":"25/03/2026","createdAt":"2026-03-03T00:00:00.000Z"},{"id":"s1367","productId":"1455","buyPrice":24.3,"sellPrice":50.73,"profit":26.43,"multi":2.09,"saleDate":"28/02/2026","receiveDate":"25/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1368","productId":"1454","buyPrice":15.0,"sellPrice":49.73,"profit":34.73,"multi":3.32,"saleDate":"04/03/2026","receiveDate":"25/03/2026","createdAt":"2026-03-04T00:00:00.000Z"},{"id":"s1369","productId":"1425","buyPrice":12.01,"sellPrice":22.48,"profit":10.47,"multi":1.87,"saleDate":"28/02/2026","receiveDate":"25/03/2026","createdAt":"2026-02-28T00:00:00.000Z"},{"id":"s1370","productId":"1486","buyPrice":16.17,"sellPrice":32.81,"profit":16.64,"multi":2.03,"saleDate":"05/03/2026","receiveDate":"25/03/2026","createdAt":"2026-03-05T00:00:00.000Z"},{"id":"s1371","productId":"1437","buyPrice":24.44,"sellPrice":63.72,"profit":39.28,"multi":2.61,"saleDate":"26/02/2026","receiveDate":"26/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1372","productId":"1492","buyPrice":18.99,"sellPrice":45.56,"profit":26.57,"multi":2.4,"saleDate":"05/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-05T00:00:00.000Z"},{"id":"s1373","productId":"1518","buyPrice":31.0,"sellPrice":77.71,"profit":46.71,"multi":2.51,"saleDate":"09/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1374","productId":"1503","buyPrice":5.0,"sellPrice":30.5,"profit":25.5,"multi":6.1,"saleDate":"06/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-06T00:00:00.000Z"},{"id":"s1375","productId":"1549","buyPrice":7.74,"sellPrice":40.5,"profit":32.76,"multi":5.23,"saleDate":"09/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1376","productId":"1185","buyPrice":36.09,"sellPrice":63.71,"profit":27.62,"multi":1.77,"saleDate":"01/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-01T00:00:00.000Z"},{"id":"s1377","productId":"1540","buyPrice":9.3,"sellPrice":25.7,"profit":16.4,"multi":2.76,"saleDate":"09/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1378","productId":"1282","buyPrice":8.36,"sellPrice":18.68,"profit":10.32,"multi":2.23,"saleDate":"03/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-03T00:00:00.000Z"},{"id":"s1379","productId":"1287","buyPrice":7.2,"sellPrice":25.67,"profit":18.47,"multi":3.57,"saleDate":"26/02/2026","receiveDate":"26/03/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1380","productId":"1058","buyPrice":24.7,"sellPrice":47.36,"profit":22.66,"multi":1.92,"saleDate":"04/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-04T00:00:00.000Z"},{"id":"s1381","productId":"1415","buyPrice":17.09,"sellPrice":50.71,"profit":33.62,"multi":2.97,"saleDate":"27/02/2026","receiveDate":"26/03/2026","createdAt":"2026-02-27T00:00:00.000Z"},{"id":"s1382","productId":"1547","buyPrice":19.5,"sellPrice":44.58,"profit":25.08,"multi":2.29,"saleDate":"09/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1383","productId":"1229","buyPrice":21.0,"sellPrice":43.5,"profit":22.5,"multi":2.07,"saleDate":"09/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1384","productId":"1483","buyPrice":12.89,"sellPrice":35.71,"profit":22.82,"multi":2.77,"saleDate":"05/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-05T00:00:00.000Z"},{"id":"s1385","productId":"1528","buyPrice":25.0,"sellPrice":60.5,"profit":35.5,"multi":2.42,"saleDate":"09/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1386","productId":"1408","buyPrice":46.48,"sellPrice":87.98,"profit":41.5,"multi":1.89,"saleDate":"09/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1387","productId":"1552","buyPrice":17.0,"sellPrice":42.48,"profit":25.48,"multi":2.5,"saleDate":"09/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1388","productId":"1494","buyPrice":40.0,"sellPrice":78.86,"profit":38.86,"multi":1.97,"saleDate":"08/03/2026","receiveDate":"26/03/2026","createdAt":"2026-03-08T00:00:00.000Z"},{"id":"s1389","productId":"1038","buyPrice":22.0,"sellPrice":40.89,"profit":18.89,"multi":1.86,"saleDate":"05/03/2026","receiveDate":"27/03/2026","createdAt":"2026-03-05T00:00:00.000Z"},{"id":"s1390","productId":"1123","buyPrice":14.79,"sellPrice":40.99,"profit":26.2,"multi":2.77,"saleDate":"09/03/2026","receiveDate":"27/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1391","productId":"1544","buyPrice":21.66,"sellPrice":45.5,"profit":23.84,"multi":2.1,"saleDate":"08/03/2026","receiveDate":"27/03/2026","createdAt":"2026-03-08T00:00:00.000Z"},{"id":"s1392","productId":"1513","buyPrice":19.49,"sellPrice":40.49,"profit":21.0,"multi":2.08,"saleDate":"07/03/2026","receiveDate":"27/03/2026","createdAt":"2026-03-07T00:00:00.000Z"},{"id":"s1393","productId":"1531","buyPrice":14.28,"sellPrice":38.48,"profit":24.2,"multi":2.69,"saleDate":"09/03/2026","receiveDate":"27/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1394","productId":"1191","buyPrice":30.1,"sellPrice":54.22,"profit":24.12,"multi":1.8,"saleDate":"03/03/2026","receiveDate":"27/03/2026","createdAt":"2026-03-03T00:00:00.000Z"},{"id":"s1395","productId":"1485","buyPrice":20.0,"sellPrice":54.89,"profit":34.89,"multi":2.74,"saleDate":"07/03/2026","receiveDate":"27/03/2026","createdAt":"2026-03-07T00:00:00.000Z"},{"id":"s1396","productId":"1200","buyPrice":15.41,"sellPrice":30.2,"profit":14.79,"multi":1.96,"saleDate":"06/03/2026","receiveDate":"27/03/2026","createdAt":"2026-03-06T00:00:00.000Z"},{"id":"s1397","productId":"1508+1509","buyPrice":10.0,"sellPrice":55.73,"profit":45.73,"multi":5.57,"saleDate":"05/03/2026","receiveDate":"27/03/2026","createdAt":"2026-03-05T00:00:00.000Z"},{"id":"s1398","productId":"1505","buyPrice":19.3,"sellPrice":37.48,"profit":18.18,"multi":1.94,"saleDate":"06/03/2026","receiveDate":"27/03/2026","createdAt":"2026-03-06T00:00:00.000Z"},{"id":"s1399","productId":"752","buyPrice":25.0,"sellPrice":34.92,"profit":9.92,"multi":1.4,"saleDate":"07/03/2026","receiveDate":"27/03/2026","createdAt":"2026-03-07T00:00:00.000Z"},{"id":"s1400","productId":"1284","buyPrice":24.3,"sellPrice":40.5,"profit":16.2,"multi":1.67,"saleDate":"08/03/2026","receiveDate":"27/03/2026","createdAt":"2026-03-08T00:00:00.000Z"},{"id":"s1401","productId":"1444","buyPrice":11.67,"sellPrice":30.5,"profit":18.83,"multi":2.61,"saleDate":"09/03/2026","receiveDate":"27/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1402","productId":"1529","buyPrice":19.54,"sellPrice":48.5,"profit":28.96,"multi":2.48,"saleDate":"08/03/2026","receiveDate":"30/03/2026","createdAt":"2026-03-08T00:00:00.000Z"},{"id":"s1403","productId":"1545","buyPrice":8.78,"sellPrice":40.56,"profit":31.78,"multi":4.62,"saleDate":"09/03/2026","receiveDate":"30/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1404","productId":"1313","buyPrice":12.2,"sellPrice":43.72,"profit":31.52,"multi":3.58,"saleDate":"27/02/2026","receiveDate":"30/03/2026","createdAt":"2026-02-27T00:00:00.000Z"},{"id":"s1405","productId":"1537","buyPrice":16.0,"sellPrice":45.55,"profit":29.55,"multi":2.85,"saleDate":"08/03/2026","receiveDate":"30/03/2026","createdAt":"2026-03-08T00:00:00.000Z"},{"id":"s1406","productId":"1555","buyPrice":20.0,"sellPrice":41.25,"profit":21.25,"multi":2.06,"saleDate":"08/03/2026","receiveDate":"30/03/2026","createdAt":"2026-03-08T00:00:00.000Z"},{"id":"s1407","productId":"1538","buyPrice":15.0,"sellPrice":38.56,"profit":23.56,"multi":2.57,"saleDate":"08/03/2026","receiveDate":"30/03/2026","createdAt":"2026-03-08T00:00:00.000Z"},{"id":"s1408","productId":"773","buyPrice":24.84,"sellPrice":33.55,"profit":8.71,"multi":1.35,"saleDate":"08/03/2026","receiveDate":"30/03/2026","createdAt":"2026-03-08T00:00:00.000Z"},{"id":"s1409","productId":"1526","buyPrice":25.0,"sellPrice":60.89,"profit":35.89,"multi":2.44,"saleDate":"09/03/2026","receiveDate":"30/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1410","productId":"1496","buyPrice":9.0,"sellPrice":35.88,"profit":26.88,"multi":3.99,"saleDate":"07/03/2026","receiveDate":"30/03/2026","createdAt":"2026-03-07T00:00:00.000Z"},{"id":"s1411","productId":"1523","buyPrice":11.39,"sellPrice":25.5,"profit":14.11,"multi":2.24,"saleDate":"08/03/2026","receiveDate":"30/03/2026","createdAt":"2026-03-08T00:00:00.000Z"},{"id":"s1412","productId":"1491","buyPrice":9.71,"sellPrice":40.5,"profit":30.79,"multi":4.17,"saleDate":"08/03/2026","receiveDate":"30/03/2026","createdAt":"2026-03-08T00:00:00.000Z"},{"id":"s1413","productId":"1515","buyPrice":19.0,"sellPrice":41.36,"profit":22.36,"multi":2.18,"saleDate":"08/03/2026","receiveDate":"31/03/2026","createdAt":"2026-03-08T00:00:00.000Z"},{"id":"s1414","productId":"1559","buyPrice":9.0,"sellPrice":25.89,"profit":16.89,"multi":2.88,"saleDate":"09/03/2026","receiveDate":"31/03/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1415","productId":"1481","buyPrice":17.8,"sellPrice":40.73,"profit":22.93,"multi":2.29,"saleDate":"05/03/2026","receiveDate":"31/03/2026","createdAt":"2026-03-05T00:00:00.000Z"},{"id":"s1416","productId":"1553","buyPrice":12.01,"sellPrice":44.6,"profit":32.59,"multi":3.71,"saleDate":"10/03/2026","receiveDate":"31/03/2026","createdAt":"2026-03-10T00:00:00.000Z"},{"id":"s1417","productId":"551","buyPrice":12.51,"sellPrice":26.5,"profit":13.99,"multi":2.12,"saleDate":"10/03/2026","receiveDate":"31/03/2026","createdAt":"2026-03-10T00:00:00.000Z"},{"id":"s1418","productId":"1569","buyPrice":9.0,"sellPrice":40.48,"profit":31.48,"multi":4.5,"saleDate":"12/03/2026","receiveDate":"31/03/2026","createdAt":"2026-03-12T00:00:00.000Z"},{"id":"s1419","productId":"1517","buyPrice":20.0,"sellPrice":58.49,"profit":38.49,"multi":2.92,"saleDate":"07/03/2026","receiveDate":"31/03/2026","createdAt":"2026-03-07T00:00:00.000Z"},{"id":"s1420","productId":"1568","buyPrice":15.54,"sellPrice":34.5,"profit":18.96,"multi":2.22,"saleDate":"13/03/2026","receiveDate":"31/03/2026","createdAt":"2026-03-13T00:00:00.000Z"},{"id":"s1421","productId":"1413","buyPrice":14.29,"sellPrice":35.5,"profit":21.21,"multi":2.48,"saleDate":"13/03/2026","receiveDate":"31/03/2026","createdAt":"2026-03-13T00:00:00.000Z"},{"id":"s1422","productId":"1479","buyPrice":15.0,"sellPrice":38.49,"profit":23.49,"multi":2.57,"saleDate":"06/03/2026","receiveDate":"01/04/2026","createdAt":"2026-03-06T00:00:00.000Z"},{"id":"s1423","productId":"1564","buyPrice":20.86,"sellPrice":40.56,"profit":19.7,"multi":1.94,"saleDate":"12/03/2026","receiveDate":"01/04/2026","createdAt":"2026-03-12T00:00:00.000Z"},{"id":"s1424","productId":"1130","buyPrice":26.43,"sellPrice":45.5,"profit":19.07,"multi":1.72,"saleDate":"11/03/2026","receiveDate":"01/04/2026","createdAt":"2026-03-11T00:00:00.000Z"},{"id":"s1425","productId":"1565","buyPrice":16.69,"sellPrice":40.99,"profit":24.3,"multi":2.46,"saleDate":"12/03/2026","receiveDate":"01/04/2026","createdAt":"2026-03-12T00:00:00.000Z"},{"id":"s1426","productId":"1498","buyPrice":21.57,"sellPrice":40.5,"profit":18.93,"multi":1.88,"saleDate":"10/03/2026","receiveDate":"01/04/2026","createdAt":"2026-03-10T00:00:00.000Z"},{"id":"s1427","productId":"1108","buyPrice":8.1,"sellPrice":25.49,"profit":17.39,"multi":3.15,"saleDate":"10/03/2026","receiveDate":"01/04/2026","createdAt":"2026-03-10T00:00:00.000Z"},{"id":"s1428","productId":"687","buyPrice":16.39,"sellPrice":47.85,"profit":31.46,"multi":2.92,"saleDate":"11/03/2026","receiveDate":"02/04/2026","createdAt":"2026-03-11T00:00:00.000Z"},{"id":"s1429","productId":"1527","buyPrice":25.59,"sellPrice":62.69,"profit":37.1,"multi":2.45,"saleDate":"09/03/2026","receiveDate":"02/04/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1430","productId":"1050","buyPrice":22.0,"sellPrice":36.48,"profit":14.48,"multi":1.66,"saleDate":"11/03/2026","receiveDate":"02/04/2026","createdAt":"2026-03-11T00:00:00.000Z"},{"id":"s1431","productId":"1512","buyPrice":14.08,"sellPrice":49.71,"profit":35.63,"multi":3.53,"saleDate":"12/03/2026","receiveDate":"02/04/2026","createdAt":"2026-03-12T00:00:00.000Z"},{"id":"s1432","productId":"1567","buyPrice":18.89,"sellPrice":49.71,"profit":30.82,"multi":2.63,"saleDate":"12/03/2026","receiveDate":"02/04/2026","createdAt":"2026-03-12T00:00:00.000Z"},{"id":"s1433","productId":"1530","buyPrice":14.48,"sellPrice":38.56,"profit":24.08,"multi":2.66,"saleDate":"10/03/2026","receiveDate":"03/04/2026","createdAt":"2026-03-10T00:00:00.000Z"},{"id":"s1434","productId":"1571","buyPrice":16.89,"sellPrice":40.56,"profit":23.67,"multi":2.4,"saleDate":"12/03/2026","receiveDate":"03/04/2026","createdAt":"2026-03-12T00:00:00.000Z"},{"id":"s1435","productId":"422","buyPrice":13.17,"sellPrice":70.5,"profit":57.33,"multi":5.35,"saleDate":"14/03/2026","receiveDate":"03/04/2026","createdAt":"2026-03-14T00:00:00.000Z"},{"id":"s1436","productId":"1578","buyPrice":16.65,"sellPrice":35.5,"profit":18.85,"multi":2.13,"saleDate":"16/03/2026","receiveDate":"03/04/2026","createdAt":"2026-03-16T00:00:00.000Z"},{"id":"s1437","productId":"1573","buyPrice":14.54,"sellPrice":30.5,"profit":15.96,"multi":2.1,"saleDate":"16/03/2026","receiveDate":"03/04/2026","createdAt":"2026-03-16T00:00:00.000Z"},{"id":"s1438","productId":"1466","buyPrice":16.58,"sellPrice":45.5,"profit":28.92,"multi":2.74,"saleDate":"15/03/2026","receiveDate":"03/04/2026","createdAt":"2026-03-15T00:00:00.000Z"},{"id":"s1439","productId":"555","buyPrice":22.94,"sellPrice":20.5,"profit":-2.44,"multi":0.89,"saleDate":"16/03/2026","receiveDate":"03/04/2026","createdAt":"2026-03-16T00:00:00.000Z"},{"id":"s1440","productId":"1519","buyPrice":23.72,"sellPrice":44.73,"profit":21.01,"multi":1.89,"saleDate":"09/03/2026","receiveDate":"06/04/2026","createdAt":"2026-03-09T00:00:00.000Z"},{"id":"s1441","productId":"1539","buyPrice":14.48,"sellPrice":37.23,"profit":22.75,"multi":2.57,"saleDate":"10/03/2026","receiveDate":"06/04/2026","createdAt":"2026-03-10T00:00:00.000Z"},{"id":"s1442","productId":"1436","buyPrice":12.24,"sellPrice":40.81,"profit":28.57,"multi":3.33,"saleDate":"12/03/2026","receiveDate":"06/04/2026","createdAt":"2026-03-12T00:00:00.000Z"},{"id":"s1443","productId":"1479","buyPrice":15.0,"sellPrice":47.8,"profit":32.8,"multi":3.19,"saleDate":"14/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-14T00:00:00.000Z"},{"id":"s1444","productId":"1270","buyPrice":7.5,"sellPrice":15.48,"profit":7.98,"multi":2.06,"saleDate":"14/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-14T00:00:00.000Z"},{"id":"s1445","productId":"1554","buyPrice":16.0,"sellPrice":41.0,"profit":25.0,"multi":2.56,"saleDate":"16/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-16T00:00:00.000Z"},{"id":"s1446","productId":"1165","buyPrice":26.87,"sellPrice":54.68,"profit":27.81,"multi":2.03,"saleDate":"15/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-15T00:00:00.000Z"},{"id":"s1447","productId":"1410","buyPrice":11.0,"sellPrice":45.73,"profit":34.73,"multi":4.16,"saleDate":"26/02/2026","receiveDate":"07/04/2026","createdAt":"2026-02-26T00:00:00.000Z"},{"id":"s1448","productId":"1581","buyPrice":14.49,"sellPrice":35.56,"profit":21.07,"multi":2.45,"saleDate":"16/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-16T00:00:00.000Z"},{"id":"s1449","productId":"1225","buyPrice":14.09,"sellPrice":21.5,"profit":7.41,"multi":1.53,"saleDate":"10/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-10T00:00:00.000Z"},{"id":"s1450","productId":"1570","buyPrice":23.99,"sellPrice":45.56,"profit":21.57,"multi":1.9,"saleDate":"13/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-13T00:00:00.000Z"},{"id":"s1451","productId":"1583","buyPrice":14.28,"sellPrice":38.5,"profit":24.22,"multi":2.7,"saleDate":"18/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-18T00:00:00.000Z"},{"id":"s1452","productId":"1572","buyPrice":35.0,"sellPrice":70.5,"profit":35.5,"multi":2.01,"saleDate":"13/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-13T00:00:00.000Z"},{"id":"s1453","productId":"1242","buyPrice":20.0,"sellPrice":46.25,"profit":26.25,"multi":2.31,"saleDate":"14/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-14T00:00:00.000Z"},{"id":"s1454","productId":"1353","buyPrice":24.44,"sellPrice":22.18,"profit":-2.26,"multi":0.91,"saleDate":"12/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-12T00:00:00.000Z"},{"id":"s1455","productId":"1259","buyPrice":8.89,"sellPrice":40.1,"profit":31.21,"multi":4.51,"saleDate":"19/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-19T00:00:00.000Z"},{"id":"s1456","productId":"1459","buyPrice":20.6,"sellPrice":38.89,"profit":18.29,"multi":1.89,"saleDate":"15/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-15T00:00:00.000Z"},{"id":"s1457","productId":"48","buyPrice":19.3,"sellPrice":28.49,"profit":9.19,"multi":1.48,"saleDate":"19/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-19T00:00:00.000Z"},{"id":"s1458","productId":"1589","buyPrice":20.0,"sellPrice":39.5,"profit":19.5,"multi":1.98,"saleDate":"18/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-18T00:00:00.000Z"},{"id":"s1459","productId":"1541","buyPrice":9.0,"sellPrice":30.48,"profit":21.48,"multi":3.39,"saleDate":"16/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-16T00:00:00.000Z"},{"id":"s1460","productId":"1582","buyPrice":45.77,"sellPrice":86.36,"profit":40.59,"multi":1.89,"saleDate":"16/03/2026","receiveDate":"07/04/2026","createdAt":"2026-03-16T00:00:00.000Z"},{"id":"s1461","productId":"1524","buyPrice":15.0,"sellPrice":42.73,"profit":27.73,"multi":2.85,"saleDate":"14/03/2026","receiveDate":"07/03/2026","createdAt":"2026-03-14T00:00:00.000Z"},{"id":"s1462","productId":"1543","buyPrice":14.29,"sellPrice":40.89,"profit":26.6,"multi":2.86,"saleDate":"17/03/2026","receiveDate":"08/04/2026","createdAt":"2026-03-17T00:00:00.000Z"},{"id":"s1463","productId":"1558","buyPrice":11.0,"sellPrice":24.81,"profit":13.81,"multi":2.26,"saleDate":"20/03/2026","receiveDate":"08/04/2026","createdAt":"2026-03-20T00:00:00.000Z"},{"id":"s1464","productId":"1157","buyPrice":46.05,"sellPrice":75.86,"profit":29.81,"multi":1.65,"saleDate":"19/03/2026","receiveDate":"08/04/2026","createdAt":"2026-03-19T00:00:00.000Z"},{"id":"s1465","productId":"2","buyPrice":26.49,"sellPrice":25.88,"profit":-0.61,"multi":0.98,"saleDate":"20/03/2026","receiveDate":"08/04/2026","createdAt":"2026-03-20T00:00:00.000Z"},{"id":"s1466","productId":"1611","buyPrice":17.0,"sellPrice":40.48,"profit":23.48,"multi":2.38,"saleDate":"19/03/2026","receiveDate":"09/04/2026","createdAt":"2026-03-19T00:00:00.000Z"},{"id":"s1467","productId":"1104","buyPrice":9.07,"sellPrice":39.48,"profit":30.41,"multi":4.35,"saleDate":"11/03/2026","receiveDate":"09/04/2026","createdAt":"2026-03-11T00:00:00.000Z"},{"id":"s1468","productId":"1442","buyPrice":23.24,"sellPrice":50.48,"profit":27.24,"multi":2.17,"saleDate":"18/03/2026","receiveDate":"09/04/2026","createdAt":"2026-03-18T00:00:00.000Z"},{"id":"s1469","productId":"1627","buyPrice":21.0,"sellPrice":40.72,"profit":19.72,"multi":1.94,"saleDate":"23/03/2026","receiveDate":"10/04/2026","createdAt":"2026-03-23T00:00:00.000Z"},{"id":"s1470","productId":"419","buyPrice":19.49,"sellPrice":50.55,"profit":31.06,"multi":2.59,"saleDate":"21/03/2026","receiveDate":"10/04/2026","createdAt":"2026-03-21T00:00:00.000Z"},{"id":"s1471","productId":"1576","buyPrice":25.0,"sellPrice":66.55,"profit":41.55,"multi":2.66,"saleDate":"21/03/2026","receiveDate":"10/04/2026","createdAt":"2026-03-21T00:00:00.000Z"},{"id":"s1472","productId":"1600","buyPrice":20.0,"sellPrice":50.72,"profit":30.72,"multi":2.54,"saleDate":"19/03/2026","receiveDate":"10/04/2026","createdAt":"2026-03-19T00:00:00.000Z"},{"id":"s1473","productId":"1477","buyPrice":9.45,"sellPrice":35.56,"profit":26.11,"multi":3.76,"saleDate":"19/03/2026","receiveDate":"10/04/2026","createdAt":"2026-03-19T00:00:00.000Z"},{"id":"s1474","productId":"1317","buyPrice":18.59,"sellPrice":40.56,"profit":21.97,"multi":2.18,"saleDate":"15/03/2026","receiveDate":"10/04/2026","createdAt":"2026-03-15T00:00:00.000Z"},{"id":"s1475","productId":"722","buyPrice":25.31,"sellPrice":28.56,"profit":3.25,"multi":1.13,"saleDate":"18/03/2026","receiveDate":"10/04/2026","createdAt":"2026-03-18T00:00:00.000Z"},{"id":"s1476","productId":"1605","buyPrice":20.0,"sellPrice":37.68,"profit":17.68,"multi":1.88,"saleDate":"19/03/2026","receiveDate":"10/04/2026","createdAt":"2026-03-19T00:00:00.000Z"},{"id":"s1477","productId":"1635","buyPrice":15.0,"sellPrice":30.5,"profit":15.5,"multi":2.03,"saleDate":"22/03/2026","receiveDate":"12/04/2026","createdAt":"2026-03-22T00:00:00.000Z"},{"id":"s1478","productId":"1617","buyPrice":15.0,"sellPrice":39.56,"profit":24.56,"multi":2.64,"saleDate":"22/03/2026","receiveDate":"13/04/2026","createdAt":"2026-03-22T00:00:00.000Z"},{"id":"s1479","productId":"1592","buyPrice":14.0,"sellPrice":30.48,"profit":16.48,"multi":2.18,"saleDate":"19/03/2026","receiveDate":"13/04/2026","createdAt":"2026-03-19T00:00:00.000Z"},{"id":"s1480","productId":"1421","buyPrice":22.7,"sellPrice":50.72,"profit":28.02,"multi":2.23,"saleDate":"17/03/2026","receiveDate":"13/04/2026","createdAt":"2026-03-17T00:00:00.000Z"},{"id":"s1481","productId":"1252","buyPrice":10.44,"sellPrice":31.16,"profit":20.72,"multi":2.98,"saleDate":"20/03/2026","receiveDate":"13/04/2026","createdAt":"2026-03-20T00:00:00.000Z"},{"id":"s1482","productId":"1615","buyPrice":15.0,"sellPrice":45.5,"profit":30.5,"multi":3.03,"saleDate":"24/04/2026","receiveDate":"13/04/2026","createdAt":"2026-04-24T00:00:00.000Z"},{"id":"s1483","productId":"1629","buyPrice":18.0,"sellPrice":45.48,"profit":27.48,"multi":2.53,"saleDate":"23/03/2026","receiveDate":"13/04/2026","createdAt":"2026-03-23T00:00:00.000Z"},{"id":"s1484","productId":"1619 et 1621","buyPrice":34.0,"sellPrice":80.73,"profit":46.73,"multi":2.37,"saleDate":"24/03/2026","receiveDate":"13/04/2026","createdAt":"2026-03-24T00:00:00.000Z"},{"id":"s1485","productId":"711","buyPrice":19.3,"sellPrice":20.56,"profit":1.26,"multi":1.07,"saleDate":"19/03/2026","receiveDate":"13/04/2026","createdAt":"2026-03-19T00:00:00.000Z"},{"id":"s1486","productId":"1616","buyPrice":15.0,"sellPrice":40.48,"profit":25.48,"multi":2.7,"saleDate":"22/03/2026","receiveDate":"13/04/2026","createdAt":"2026-03-22T00:00:00.000Z"},{"id":"s1487","productId":"1598","buyPrice":11.0,"sellPrice":27.72,"profit":16.72,"multi":2.52,"saleDate":"17/03/2026","receiveDate":"13/04/2026","createdAt":"2026-03-17T00:00:00.000Z"},{"id":"s1488","productId":"1140 et 698","buyPrice":33.8,"sellPrice":63.73,"profit":29.93,"multi":1.89,"saleDate":"22/03/2026","receiveDate":"13/04/2026","createdAt":"2026-03-22T00:00:00.000Z"},{"id":"s1489","productId":"1599","buyPrice":20.0,"sellPrice":39.72,"profit":19.72,"multi":1.99,"saleDate":"18/03/2026","receiveDate":"13/04/2026","createdAt":"2026-03-18T00:00:00.000Z"},{"id":"s1490","productId":"1585","buyPrice":24.0,"sellPrice":65.48,"profit":41.48,"multi":2.73,"saleDate":"22/03/2026","receiveDate":"13/04/2026","createdAt":"2026-03-22T00:00:00.000Z"},{"id":"s1491","productId":"1625","buyPrice":18.0,"sellPrice":40.89,"profit":22.89,"multi":2.27,"saleDate":"22/03/2026","receiveDate":"13/04/2026","createdAt":"2026-03-22T00:00:00.000Z"},{"id":"s1492","productId":"1606","buyPrice":12.2,"sellPrice":38.71,"profit":26.51,"multi":3.17,"saleDate":"19/03/2026","receiveDate":"14/04/2026","createdAt":"2026-03-19T00:00:00.000Z"},{"id":"s1493","productId":"1626","buyPrice":15.0,"sellPrice":35.72,"profit":20.72,"multi":2.38,"saleDate":"22/03/2026","receiveDate":"14/04/2026","createdAt":"2026-03-22T00:00:00.000Z"},{"id":"s1494","productId":"1584","buyPrice":12.2,"sellPrice":30.72,"profit":18.52,"multi":2.52,"saleDate":"24/03/2026","receiveDate":"14/04/2026","createdAt":"2026-03-24T00:00:00.000Z"},{"id":"s1495","productId":"1613","buyPrice":20.0,"sellPrice":57.55,"profit":37.55,"multi":2.88,"saleDate":"22/03/2026","receiveDate":"14/04/2026","createdAt":"2026-03-22T00:00:00.000Z"},{"id":"s1496","productId":"1601","buyPrice":20.0,"sellPrice":50.56,"profit":30.56,"multi":2.53,"saleDate":"24/03/2026","receiveDate":"15/04/2026","createdAt":"2026-03-24T00:00:00.000Z"},{"id":"s1497","productId":"1593","buyPrice":9.0,"sellPrice":35.56,"profit":26.56,"multi":3.95,"saleDate":"28/03/2026","receiveDate":"15/04/2026","createdAt":"2026-03-28T00:00:00.000Z"},{"id":"s1498","productId":"1624","buyPrice":18.0,"sellPrice":45.5,"profit":27.5,"multi":2.53,"saleDate":"22/03/2026","receiveDate":"15/04/2026","createdAt":"2026-03-22T00:00:00.000Z"},{"id":"s1499","productId":"779","buyPrice":14.31,"sellPrice":32.73,"profit":18.42,"multi":2.29,"saleDate":"16/03/2026","receiveDate":"15/04/2026","createdAt":"2026-03-16T00:00:00.000Z"},{"id":"s1500","productId":"1562","buyPrice":17.0,"sellPrice":40.48,"profit":23.48,"multi":2.38,"saleDate":"14/03/2026","receiveDate":"16/04/2026","createdAt":"2026-03-14T00:00:00.000Z"},{"id":"s1501","productId":"1602","buyPrice":20.0,"sellPrice":48.56,"profit":28.56,"multi":2.43,"saleDate":"29/03/2026","receiveDate":"16/04/2026","createdAt":"2026-03-29T00:00:00.000Z"},{"id":"s1502","productId":"1412","buyPrice":14.19,"sellPrice":30.72,"profit":16.53,"multi":2.16,"saleDate":"24/03/2026","receiveDate":"16/04/2026","createdAt":"2026-03-24T00:00:00.000Z"},{"id":"s1503","productId":"1354","buyPrice":9.71,"sellPrice":41.0,"profit":31.29,"multi":4.22,"saleDate":"25/03/2026","receiveDate":"16/04/2026","createdAt":"2026-03-25T00:00:00.000Z"},{"id":"s1504","productId":"1609","buyPrice":20.0,"sellPrice":52.03,"profit":32.03,"multi":2.6,"saleDate":"24/03/2026","receiveDate":"16/04/2026","createdAt":"2026-03-24T00:00:00.000Z"},{"id":"s1505","productId":"1215","buyPrice":19.49,"sellPrice":50.5,"profit":31.01,"multi":2.59,"saleDate":"25/03/2026","receiveDate":"16/04/2026","createdAt":"2026-03-25T00:00:00.000Z"},{"id":"s1506","productId":"1630","buyPrice":15.0,"sellPrice":43.55,"profit":28.55,"multi":2.9,"saleDate":"28/03/2026","receiveDate":"16/04/2026","createdAt":"2026-03-28T00:00:00.000Z"},{"id":"s1507","productId":"516","buyPrice":37.32,"sellPrice":50.5,"profit":13.18,"multi":1.35,"saleDate":"29/03/2026","receiveDate":"16/04/2026","createdAt":"2026-03-29T00:00:00.000Z"},{"id":"s1508","productId":"1648","buyPrice":9.0,"sellPrice":32.9,"profit":23.9,"multi":3.66,"saleDate":"29/03/2026","receiveDate":"16/04/2026","createdAt":"2026-03-29T00:00:00.000Z"},{"id":"s1509","productId":"884","buyPrice":26.81,"sellPrice":26.71,"profit":-0.1,"multi":1.0,"saleDate":"21/03/2026","receiveDate":"16/04/2026","createdAt":"2026-03-21T00:00:00.000Z"},{"id":"s1510","productId":"1217 et 1506","buyPrice":32.0,"sellPrice":78.93,"profit":46.93,"multi":2.47,"saleDate":"29/03/2026","receiveDate":"16/04/2026","createdAt":"2026-03-29T00:00:00.000Z"},{"id":"s1511","productId":"1070","buyPrice":25.62,"sellPrice":30.56,"profit":4.94,"multi":1.19,"saleDate":"26/03/2026","receiveDate":"16/04/2026","createdAt":"2026-03-26T00:00:00.000Z"},{"id":"s1512","productId":"1604","buyPrice":19.0,"sellPrice":50.47,"profit":31.47,"multi":2.66,"saleDate":"28/03/2026","receiveDate":"16/04/2026","createdAt":"2026-03-28T00:00:00.000Z"},{"id":"s1513","productId":"1399","buyPrice":15.0,"sellPrice":25.72,"profit":10.72,"multi":1.71,"saleDate":"25/03/2026","receiveDate":"17/04/2026","createdAt":"2026-03-25T00:00:00.000Z"},{"id":"s1514","productId":"1652","buyPrice":13.0,"sellPrice":35.55,"profit":22.55,"multi":2.73,"saleDate":"28/03/2026","receiveDate":"17/04/2026","createdAt":"2026-03-28T00:00:00.000Z"},{"id":"s1515","productId":"1654","buyPrice":12.0,"sellPrice":28.89,"profit":16.89,"multi":2.41,"saleDate":"30/03/2026","receiveDate":"17/04/2026","createdAt":"2026-03-30T00:00:00.000Z"},{"id":"s1516","productId":"1674","buyPrice":12.0,"sellPrice":30.49,"profit":18.49,"multi":2.54,"saleDate":"30/03/2026","receiveDate":"20/04/2026","createdAt":"2026-03-30T00:00:00.000Z"},{"id":"s1517","productId":"1596","buyPrice":6.0,"sellPrice":32.72,"profit":26.72,"multi":5.45,"saleDate":"28/03/2026","receiveDate":"17/04/2026","createdAt":"2026-03-28T00:00:00.000Z"},{"id":"s1518","productId":"1499","buyPrice":14.89,"sellPrice":40.48,"profit":25.59,"multi":2.72,"saleDate":"30/03/2026","receiveDate":"17/04/2026","createdAt":"2026-03-30T00:00:00.000Z"},{"id":"s1519","productId":"1670","buyPrice":15.0,"sellPrice":35.48,"profit":20.48,"multi":2.37,"saleDate":"30/03/2026","receiveDate":"20/04/2026","createdAt":"2026-03-30T00:00:00.000Z"},{"id":"s1520","productId":"1534","buyPrice":19.49,"sellPrice":50.71,"profit":31.22,"multi":2.6,"saleDate":"01/04/2026","receiveDate":"20/04/2026","createdAt":"2026-04-01T00:00:00.000Z"},{"id":"s1521","productId":"1333","buyPrice":14.19,"sellPrice":35.5,"profit":21.31,"multi":2.5,"saleDate":"31/03/2026","receiveDate":"20/04/2026","createdAt":"2026-03-31T00:00:00.000Z"},{"id":"s1522","productId":"945","buyPrice":19.09,"sellPrice":38.5,"profit":19.41,"multi":2.02,"saleDate":"30/03/2026","receiveDate":"20/04/2026","createdAt":"2026-03-30T00:00:00.000Z"},{"id":"s1523","productId":"1375","buyPrice":13.49,"sellPrice":30.99,"profit":17.5,"multi":2.3,"saleDate":"24/03/2026","receiveDate":"20/04/2026","createdAt":"2026-03-24T00:00:00.000Z"},{"id":"s1524","productId":"861 et 1608","buyPrice":32.0,"sellPrice":60.71,"profit":28.71,"multi":1.9,"saleDate":"19/03/2026","receiveDate":"21/04/2026","createdAt":"2026-03-19T00:00:00.000Z"},{"id":"s1525","productId":"1649","buyPrice":16.59,"sellPrice":44.56,"profit":27.97,"multi":2.69,"saleDate":"28/03/2026","receiveDate":"21/04/2026","createdAt":"2026-03-28T00:00:00.000Z"},{"id":"s1526","productId":"1656","buyPrice":17.0,"sellPrice":45.5,"profit":28.5,"multi":2.68,"saleDate":"30/03/2026","receiveDate":"21/04/2026","createdAt":"2026-03-30T00:00:00.000Z"},{"id":"s1527","productId":"1666","buyPrice":20.76,"sellPrice":48.5,"profit":27.74,"multi":2.34,"saleDate":"03/04/2026","receiveDate":"22/04/2026","createdAt":"2026-04-03T00:00:00.000Z"},{"id":"s1528","productId":"751","buyPrice":25.0,"sellPrice":30.53,"profit":5.53,"multi":1.22,"saleDate":"02/04/2026","receiveDate":"22/04/2026","createdAt":"2026-04-02T00:00:00.000Z"},{"id":"s1529","productId":"1468","buyPrice":8.58,"sellPrice":20.5,"profit":11.92,"multi":2.39,"saleDate":"01/04/2026","receiveDate":"22/04/2026","createdAt":"2026-04-01T00:00:00.000Z"},{"id":"s1530","productId":"1669","buyPrice":16.0,"sellPrice":41.39,"profit":25.39,"multi":2.59,"saleDate":"29/03/2026","receiveDate":"22/04/2026","createdAt":"2026-03-29T00:00:00.000Z"},{"id":"s1531","productId":"1522","buyPrice":19.56,"sellPrice":55.47,"profit":35.91,"multi":2.84,"saleDate":"31/03/2026","receiveDate":"22/04/2026","createdAt":"2026-03-31T00:00:00.000Z"},{"id":"s1532","productId":"1644","buyPrice":10.0,"sellPrice":30.72,"profit":20.72,"multi":3.07,"saleDate":"27/03/2026","receiveDate":"22/04/2026","createdAt":"2026-03-27T00:00:00.000Z"},{"id":"s1533","productId":"1489","buyPrice":9.9,"sellPrice":25.5,"profit":15.6,"multi":2.58,"saleDate":"03/04/2026","receiveDate":"22/04/2026","createdAt":"2026-04-03T00:00:00.000Z"},{"id":"s1534","productId":"76","buyPrice":20.64,"sellPrice":23.73,"profit":3.09,"multi":1.15,"saleDate":"03/04/2026","receiveDate":"22/04/2026","createdAt":"2026-04-03T00:00:00.000Z"},{"id":"s1535","productId":"1646","buyPrice":12.0,"sellPrice":35.72,"profit":23.72,"multi":2.98,"saleDate":"30/03/2026","receiveDate":"22/04/2026","createdAt":"2026-03-30T00:00:00.000Z"},{"id":"s1536","productId":"1682","buyPrice":21.0,"sellPrice":50.48,"profit":29.48,"multi":2.4,"saleDate":"05/04/2026","receiveDate":"23/04/2026","createdAt":"2026-04-05T00:00:00.000Z"},{"id":"s1537","productId":"361","buyPrice":16.92,"sellPrice":26.55,"profit":9.63,"multi":1.57,"saleDate":"01/04/2026","receiveDate":"23/04/2026","createdAt":"2026-04-01T00:00:00.000Z"},{"id":"s1538","productId":"1463","buyPrice":13.99,"sellPrice":47.71,"profit":33.72,"multi":3.41,"saleDate":"31/03/2026","receiveDate":"23/04/2026","createdAt":"2026-03-31T00:00:00.000Z"},{"id":"s1539","productId":"663","buyPrice":19.49,"sellPrice":35.48,"profit":15.99,"multi":1.82,"saleDate":"04/04/2026","receiveDate":"23/04/2026","createdAt":"2026-04-04T00:00:00.000Z"},{"id":"s1540","productId":"355","buyPrice":14.29,"sellPrice":18.06,"profit":3.77,"multi":1.26,"saleDate":"29/03/2026","receiveDate":"23/04/2026","createdAt":"2026-03-29T00:00:00.000Z"},{"id":"s1541","productId":"1556","buyPrice":14.0,"sellPrice":35.56,"profit":21.56,"multi":2.54,"saleDate":"28/03/2026","receiveDate":"23/04/2026","createdAt":"2026-03-28T00:00:00.000Z"},{"id":"s1542","productId":"990","buyPrice":19.73,"sellPrice":44.5,"profit":24.77,"multi":2.26,"saleDate":"06/04/2026","receiveDate":"24/04/2026","createdAt":"2026-04-06T00:00:00.000Z"},{"id":"s1543","productId":"1673","buyPrice":17.0,"sellPrice":39.88,"profit":22.88,"multi":2.35,"saleDate":"02/04/2026","receiveDate":"24/04/2026","createdAt":"2026-04-02T00:00:00.000Z"},{"id":"s1544","productId":"210","buyPrice":19.44,"sellPrice":43.49,"profit":24.05,"multi":2.24,"saleDate":"05/04/2026","receiveDate":"24/04/2026","createdAt":"2026-04-05T00:00:00.000Z"},{"id":"s1545","productId":"1051","buyPrice":20.0,"sellPrice":32.5,"profit":12.5,"multi":1.62,"saleDate":"04/04/2026","receiveDate":"24/04/2026","createdAt":"2026-04-04T00:00:00.000Z"},{"id":"s1546","productId":"498","buyPrice":13.75,"sellPrice":13.75,"profit":0.0,"multi":1.0,"saleDate":"01/04/2026","receiveDate":"25/04/2026","createdAt":"2026-04-01T00:00:00.000Z"},{"id":"s1547","productId":"136","buyPrice":13.88,"sellPrice":15.5,"profit":1.62,"multi":1.12,"saleDate":"04/04/2026","receiveDate":"24/04/2026","createdAt":"2026-04-04T00:00:00.000Z"},{"id":"s1548","productId":"1367","buyPrice":16.29,"sellPrice":30.56,"profit":14.27,"multi":1.88,"saleDate":"06/04/2026","receiveDate":"24/04/2026","createdAt":"2026-04-06T00:00:00.000Z"},{"id":"s1549","productId":"1675","buyPrice":11.0,"sellPrice":36.71,"profit":25.71,"multi":3.34,"saleDate":"30/03/2026","receiveDate":"24/04/2026","createdAt":"2026-03-30T00:00:00.000Z"},{"id":"s1550","productId":"1209","buyPrice":31.01,"sellPrice":52.48,"profit":21.47,"multi":1.69,"saleDate":"04/04/2026","receiveDate":"24/04/2026","createdAt":"2026-04-04T00:00:00.000Z"},{"id":"s1551","productId":"220","buyPrice":21.38,"sellPrice":18.48,"profit":-2.9,"multi":0.86,"saleDate":"03/04/2026","receiveDate":"24/04/2026","createdAt":"2026-04-03T00:00:00.000Z"},{"id":"s1552","productId":"1683","buyPrice":14.09,"sellPrice":40.72,"profit":26.63,"multi":2.89,"saleDate":"05/04/2026","receiveDate":"24/04/2026","createdAt":"2026-04-05T00:00:00.000Z"},{"id":"s1553","productId":"1395","buyPrice":19.44,"sellPrice":35.89,"profit":16.45,"multi":1.85,"saleDate":"04/04/2026","receiveDate":"24/04/2026","createdAt":"2026-04-04T00:00:00.000Z"},{"id":"s1554","productId":"1266","buyPrice":19.49,"sellPrice":40.48,"profit":20.99,"multi":2.08,"saleDate":"29/03/2026","receiveDate":"24/04/2026","createdAt":"2026-03-29T00:00:00.000Z"},{"id":"s1555","productId":"615","buyPrice":15.88,"sellPrice":12.5,"profit":-3.38,"multi":0.79,"saleDate":"06/04/2026","receiveDate":"27/04/2026","createdAt":"2026-04-06T00:00:00.000Z"},{"id":"s1556","productId":"1597","buyPrice":6.0,"sellPrice":24.81,"profit":18.81,"multi":4.13,"saleDate":"06/04/2026","receiveDate":"27/04/2026","createdAt":"2026-04-06T00:00:00.000Z"},{"id":"s1557","productId":"1314","buyPrice":21.94,"sellPrice":40.48,"profit":18.54,"multi":1.85,"saleDate":"04/04/2026","receiveDate":"27/04/2026","createdAt":"2026-04-04T00:00:00.000Z"},{"id":"s1558","productId":"1678","buyPrice":20.0,"sellPrice":49.8,"profit":29.8,"multi":2.49,"saleDate":"05/04/2026","receiveDate":"27/04/2026","createdAt":"2026-04-05T00:00:00.000Z"},{"id":"s1559","productId":"1525","buyPrice":15.0,"sellPrice":30.88,"profit":15.88,"multi":2.06,"saleDate":"03/04/2026","receiveDate":"27/04/2026","createdAt":"2026-04-03T00:00:00.000Z"},{"id":"s1560","productId":"1069","buyPrice":24.7,"sellPrice":40.48,"profit":15.78,"multi":1.64,"saleDate":"05/04/2026","receiveDate":"27/04/2026","createdAt":"2026-04-05T00:00:00.000Z"},{"id":"s1561","productId":"1639","buyPrice":20.0,"sellPrice":35.73,"profit":15.73,"multi":1.79,"saleDate":"06/04/2026","receiveDate":"27/04/2026","createdAt":"2026-04-06T00:00:00.000Z"},{"id":"s1562","productId":"1482","buyPrice":1.0,"sellPrice":50.99,"profit":49.99,"multi":50.99,"saleDate":"05/04/2026","receiveDate":"27/04/2026","createdAt":"2026-04-05T00:00:00.000Z"},{"id":"s1563","productId":"927","buyPrice":16.36,"sellPrice":40.99,"profit":24.63,"multi":2.51,"saleDate":"06/04/2026","receiveDate":"27/04/2026","createdAt":"2026-04-06T00:00:00.000Z"},{"id":"s1564","productId":"1665","buyPrice":25.81,"sellPrice":48.48,"profit":22.67,"multi":1.88,"saleDate":"04/04/2026","receiveDate":"27/04/2026","createdAt":"2026-04-04T00:00:00.000Z"},{"id":"s1565","productId":"776","buyPrice":26.29,"sellPrice":33.8,"profit":7.51,"multi":1.29,"saleDate":"05/04/2026","receiveDate":"27/04/2026","createdAt":"2026-04-05T00:00:00.000Z"},{"id":"s1566","productId":"1651","buyPrice":15.0,"sellPrice":30.56,"profit":15.56,"multi":2.04,"saleDate":"28/03/2026","receiveDate":"27/04/2026","createdAt":"2026-03-28T00:00:00.000Z"},{"id":"s1567","productId":"1650","buyPrice":14.0,"sellPrice":40.49,"profit":26.49,"multi":2.89,"saleDate":"07/04/2026","receiveDate":"27/04/2026","createdAt":"2026-04-07T00:00:00.000Z"},{"id":"s1568","productId":"1687","buyPrice":16.87,"sellPrice":35.86,"profit":18.99,"multi":2.13,"saleDate":"05/04/2026","receiveDate":"28/04/2026","createdAt":"2026-04-05T00:00:00.000Z"},{"id":"s1569","productId":"1032","buyPrice":24.7,"sellPrice":33.8,"profit":9.1,"multi":1.37,"saleDate":"06/04/2026","receiveDate":"28/04/2026","createdAt":"2026-04-06T00:00:00.000Z"},{"id":"s1570","productId":"1658","buyPrice":14.0,"sellPrice":29.55,"profit":15.55,"multi":2.11,"saleDate":"06/04/2026","receiveDate":"28/04/2026","createdAt":"2026-04-06T00:00:00.000Z"},{"id":"s1571","productId":"1668","buyPrice":11.0,"sellPrice":49.55,"profit":38.55,"multi":4.5,"saleDate":"07/04/2026","receiveDate":"28/04/2026","createdAt":"2026-04-07T00:00:00.000Z"},{"id":"s1572","productId":"1267","buyPrice":14.16,"sellPrice":32.39,"profit":18.23,"multi":2.29,"saleDate":"06/04/2026","receiveDate":"28/04/2026","createdAt":"2026-04-06T00:00:00.000Z"},{"id":"s1573","productId":"1280","buyPrice":18.53,"sellPrice":35.72,"profit":17.19,"multi":1.93,"saleDate":"07/04/2026","receiveDate":"29/04/2026","createdAt":"2026-04-07T00:00:00.000Z"},{"id":"s1574","productId":"826","buyPrice":30.0,"sellPrice":65.24,"profit":35.24,"multi":2.17,"saleDate":"05/04/2026","receiveDate":"29/04/2026","createdAt":"2026-04-05T00:00:00.000Z"},{"id":"s1575","productId":"514","buyPrice":15.39,"sellPrice":38.24,"profit":22.85,"multi":2.48,"saleDate":"05/04/2026","receiveDate":"29/04/2026","createdAt":"2026-04-05T00:00:00.000Z"},{"id":"s1576","productId":"415","buyPrice":22.74,"sellPrice":30.71,"profit":7.97,"multi":1.35,"saleDate":"05/04/2026","receiveDate":"29/04/2026","createdAt":"2026-04-05T00:00:00.000Z"},{"id":"s1577","productId":"666","buyPrice":24.0,"sellPrice":20.71,"profit":-3.29,"multi":0.86,"saleDate":"05/04/2026","receiveDate":"29/04/2026","createdAt":"2026-04-05T00:00:00.000Z"},{"id":"s1578","productId":"1574","buyPrice":14.48,"sellPrice":47.22,"profit":32.74,"multi":3.26,"saleDate":"05/04/2026","receiveDate":"29/04/2026","createdAt":"2026-04-05T00:00:00.000Z"},{"id":"s1579","productId":"1667","buyPrice":19.3,"sellPrice":40.72,"profit":21.42,"multi":2.11,"saleDate":"08/04/2026","receiveDate":"30/04/2026","createdAt":"2026-04-08T00:00:00.000Z"}];

// ============ SYNCHRO FIREBASE (Mac <-> iPhone) ============
// Base de donnees en ligne : les donnees sont partagees entre tous les appareils
const FIREBASE_URL = "https://shop-cancale67-default-rtdb.europe-west1.firebasedatabase.app/cancale.json";

// Liste des cles synchronisees dans le cloud (logo exclu — trop lourd)
const SYNC_KEYS = [
  'vinted_catalog','vinted_sales','vinted_garage_grid','vinted_blocked',
  'vinted_extracols','vinted_colors','vinted_invoices',
  'vinted_invoice_settings','vinted_dark','vinted_stock_vinted','vinted_accounts',
  'vinted_bordereaux','vinted_appsscript_url',
];

// Indicateur de synchro (mis a jour par l'app)
let _syncListeners = [];
const onSyncChange = (fn) => { _syncListeners.push(fn); return () => { _syncListeners = _syncListeners.filter(f=>f!==fn); }; };
const _emitSync = (status) => { _syncListeners.forEach(fn=>{ try{fn(status);}catch(_){}}); };

// Lecture locale (instantanee)
const load = (k,d) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):d; } catch { return d; } };

// Recupere TOUT le contenu du cloud (au demarrage)
const cloudLoad = async () => {
  try {
    const res = await fetch(FIREBASE_URL);
    if (!res.ok) return null;
    const data = await res.json();
    return data || null;
  } catch (_) { return null; }
};

// Envoie TOUT le contenu local vers le cloud (groupe, differe 5s)
let _cloudTimer = null;
const cloudPush = () => {
  if (_cloudTimer) clearTimeout(_cloudTimer);
  _emitSync('saving');
  _cloudTimer = setTimeout(async () => {
    try {
      const payload = {};
      SYNC_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) { try { payload[k] = JSON.parse(v); } catch { payload[k] = v; } } });
      const res = await fetch(FIREBASE_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      _emitSync(res.ok ? 'synced' : 'error');
    } catch (_) { _emitSync('error'); }
    _cloudTimer = null;
  }, 5000);
};

// Sauvegarde : localStorage immediat (differe 500ms) PUIS push cloud
let _saveTimers = {};
const save = (k,v) => {
  if (_saveTimers[k]) clearTimeout(_saveTimers[k]);
  _saveTimers[k] = setTimeout(() => {
    try { localStorage.setItem(k,JSON.stringify(v)); } catch {}
    delete _saveTimers[k];
    if (SYNC_KEYS.includes(k)) cloudPush(); // declenche la synchro cloud
  }, 500);
};

// Synchro avec Google Sheets
async function syncFromSheets() {
  try {
    const r = await fetch(API_URL);
    const data = await r.json();
    if (data.error) { console.error('Sync error:', data.error); return null; }
    if (data.catalog && data.catalog.length > 0) save('vinted_catalog', data.catalog);
    if (data.sales && data.sales.length > 0) save('vinted_sales', data.sales);
    if (data.garageGrid && Object.keys(data.garageGrid).length > 0) save('vinted_garage_grid', data.garageGrid);
    return data;
  } catch (err) {
    console.error('Sync failed:', err);
    return null;
  }
}

async function syncToSheets(catalog, sales, garageGrid) {
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ catalog, sales, garageGrid })
    });
    return true;
  } catch (err) {
    console.error('Sync up failed:', err);
    return false;
  }
}
const fmt  = n => isNaN(+n)?'—':Number(n).toFixed(2).replace('.',',')+' €';
const fmtN = n => isNaN(+n)?'—':Number(n).toFixed(2).replace('.',',');
const uid  = () => Math.random().toString(36).slice(2,9);
const tod  = () => new Date().toLocaleDateString('fr-FR');

const KNOWN_BRANDS=['New Balance','Under Armour','Air Jordan','Le Coq Sportif','Sergio Tacchini',
  'Nike','Adidas','Asics','Jordan','Puma','Reebok','Vans','Converse','Lacoste','Wilson',
  'Babolat','Head','Yonex','Salomon','Brooks','Hoka','Mizuno','Fila','Saucony','New Era',
  'Kappa','Hummel','Umbro','Ellesse','Diadora','Lotto'];
function extractBrand(text){
  if(!text) return null;
  const t=text.toLowerCase();
  for(const b of KNOWN_BRANDS){if(t.includes(b.toLowerCase())) return b;}
  return null;
}
const COUNTRY_MAP_DATA=[
  [['france'],'France'],[['allemagne','deutschland','germany'],'Allemagne'],
  [['belgique','belgium','belgie'],'Belgique'],[['espagne','españa','spain','espana'],'Espagne'],
  [['italie','italia','italy'],'Italie'],[['pays-bas','nederland','netherlands','holland'],'Pays-Bas'],
  [['suisse','schweiz','switzerland'],'Suisse'],[['luxembourg'],'Luxembourg'],
  [['autriche','österreich','austria','osterreich'],'Autriche'],[['portugal'],'Portugal'],
  [['pologne','poland','polska'],'Pologne'],[['roumanie','romania'],'Roumanie'],
  [['suede','sweden','sverige'],'Suède'],[['danemark','denmark','danmark'],'Danemark'],
  [['tchequie','czech','tschechien'],'Tchéquie'],
];
function extractCountry(address){
  if(!address) return 'France';
  const lines=address.split(/[\n,]+/).map(l=>l.trim().toLowerCase()).filter(Boolean);
  for(const line of [...lines].reverse()){
    for(const [keys,name] of COUNTRY_MAP_DATA){
      if(keys.some(k=>line.includes(k))) return name;
    }
  }
  return 'France';
}
function getISOWeekKey(){
  const d=new Date();const day=d.getDay()||7;
  d.setDate(d.getDate()+4-day);
  const y=d.getFullYear();
  const wk=Math.ceil(((d-new Date(y,0,1))/864e5+1)/7);
  return `${y}-W${String(wk).padStart(2,'0')}`;
}

// ── Notifications ──────────────────────────────────────
// Demande la permission d'envoyer des notifications (à appeler sur action utilisateur).
function askNotifPermission(){
  if(typeof Notification==='undefined') return Promise.resolve('unsupported');
  if(Notification.permission==='granted') return Promise.resolve('granted');
  return Notification.requestPermission().catch(()=>'denied');
}
// Envoie une notification navigateur si autorisée (app ouverte / en arrière-plan récent).
function pushNotif(title, body){
  try{
    if(typeof Notification!=='undefined' && Notification.permission==='granted'){
      new Notification(title, { body, icon:'/icon-192.png', badge:'/icon-192.png' });
      return true;
    }
  }catch(_){/* ignore */}
  return false;
}


// Garage : une seule zone neutre. L'utilisateur ajoute lui-même ses colonnes
// via le bouton +. La porte est optionnelle (bouton afficher/masquer).
// On démarre avec 1 colonne ; tout le reste s'ajoute à la main.
const LAYOUT = [
  {id:"zone", name:"", elev:0, cols:[25]},
];
const TOTAL_SLOTS = LAYOUT.reduce((s,z)=>s+z.cols.reduce((ss,b)=>ss+b,0),0);

// Garage vide par défaut
const INIT_GARAGE = {};

const INIT_ACCOUNTS=[
  {id:'acc1',name:'Compte 1',color:'#007782'},
  {id:'acc2',name:'Compte 2',color:'#e67e22'},
  {id:'acc3',name:'Compte 3',color:'#9b59b6'},
];

// Ancienne disposition (4 zones) → nouvelle disposition (zone unique)
const OLD_ZONES = [{id:'bureau',cols:4},{id:'sol',cols:3},{id:'porte',cols:1},{id:'grande',cols:10}];
function migrateGarageData(garageGrid, blockedCells, cellColors) {
  const isOldKey = k => OLD_ZONES.some(z => k.match(new RegExp(`^${z.id}_\\d+$`)));
  const hasOld = Object.keys(garageGrid).some(isOldKey);
  if (!hasOld) return null;
  const hasNew = Object.keys(garageGrid).some(k => k.startsWith('zone_'));
  const maxZone = k => { const m=k.match(/^zone_(\d+)$/); return m?+m[1]:0; };
  if (hasNew) {
    // Migration déjà faite : supprimer les anciennes clés sans toucher aux zone_
    const newGrid = {};
    Object.entries(garageGrid).forEach(([k,v]) => { if(!isOldKey(k)) newGrid[k]=v; });
    const stripOld = obj => { const o={}; Object.entries(obj||{}).forEach(([k,v])=>{ const m=k.match(/^([^_]+)_\d+_\d+$/); if(!m||!OLD_ZONES.some(z=>z.id===m[1])) o[k]=v; }); return o; };
    const maxN = Math.max(0,...Object.keys(newGrid).map(maxZone));
    return { garageGrid:newGrid, blockedCells:stripOld(blockedCells), cellColors:stripOld(cellColors), extraCols:{zone:maxN} };
  }
  // Première migration : convertir toutes les colonnes (base + extras) en zone_N
  const colMap = {};
  let n = 0;
  OLD_ZONES.forEach(z => {
    Object.keys(garageGrid)
      .filter(k => k.match(new RegExp(`^${z.id}_\\d+$`)))
      .sort((a,b) => parseInt(a.split('_').pop(),10)-parseInt(b.split('_').pop(),10))
      .forEach(k => { colMap[k]=`zone_${n++}`; });
  });
  const newGrid = {};
  Object.entries(garageGrid).forEach(([k,v]) => { newGrid[colMap[k]||k]=v; });
  const migrateKeyed = obj => {
    const out = {};
    Object.entries(obj||{}).forEach(([k,v]) => {
      const m=k.match(/^([^_]+)_(\d+)_(\d+)$/);
      const mapped=m&&colMap[`${m[1]}_${m[2]}`];
      out[mapped?`${mapped}_${m[3]}`:k]=v;
    });
    return out;
  };
  const maxN = Math.max(0,...Object.keys(newGrid).map(maxZone));
  return { garageGrid:newGrid, blockedCells:migrateKeyed(blockedCells), cellColors:migrateKeyed(cellColors), extraCols:{zone:maxN} };
}

/* ── Editable cell ───────────────────────────────────── */
function Cell({value, onChange, align="left", mono=false}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const commit = () => { setEditing(false); if(String(val)!==String(value)) onChange(val); };
  if(editing) return (
    <input autoFocus value={val}
      onChange={e=>setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape'){setVal(value);setEditing(false);}}}
      style={{background:C.surface,border:`1px solid ${C.accent}`,borderRadius:8,
        color:C.text,padding:'3px 6px',fontSize:12,fontFamily:'inherit',
        width:'100%',boxSizing:'border-box',textAlign:align,outline:'none'}}
    />
  );
  return (
    <span onClick={()=>{setVal(value);setEditing(true);}} title="Cliquer pour modifier"
      style={{cursor:'text',display:'block',padding:'3px 6px',borderRadius:8,minHeight:22,
        textAlign:align,fontFamily:mono?'monospace':'inherit'}}
      onMouseEnter={e=>e.currentTarget.style.background=C.bg}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
    >{value||<span style={{color:C.muted,fontSize:10}}>—</span>}</span>
  );
}

/* ── UI ──────────────────────────────────────────────── */
function Btn({children,onClick,color,small,danger,outline,disabled,style={}}) {
  const bg=outline?'transparent':(danger?C.danger:(color||C.accent));
  const col=outline?(color||C.accent):(color?'#fff':C.onAccent);
  return (
    <button type="button" onClick={onClick} disabled={!!disabled} style={{
      background:bg,color:col,
      border:outline?`1.5px solid ${color||C.accent}`:'none',
      borderRadius:6,padding:small?'6px 14px':'10px 22px',
      fontSize:small?12:14,fontWeight:700,
      cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.4:1,
      fontFamily:'inherit',...style,
    }}>{children}</button>
  );
}
function Input({label,...p}) {
  return (
    <label style={{display:'flex',flexDirection:'column',gap:4}}>
      {label&&<span style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>{label}</span>}
      <input {...p} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,
        color:C.text,padding:'8px 12px',fontSize:13,outline:'none',fontFamily:'inherit',...(p.style||{})}}
        onFocus={e=>e.target.style.borderColor=C.accent}
        onBlur={e=>e.target.style.borderColor=C.border}
      />
    </label>
  );
}
function Card({children,style={}}) {
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:20,...style}}>{children}</div>;
}
function Badge({children,color}) {
  return <span style={{display:'inline-block',padding:'2px 10px',borderRadius:999,background:color+'22',color,fontSize:11,fontWeight:700}}>{children}</span>;
}
function StatBox({label,value,color=C.text,sub=null}) {
  return (
    <Card style={{flex:1,minWidth:110}}>
      <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>{label}</div>
      <div style={{fontSize:18,fontWeight:800,color,lineHeight:1.2}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:C.muted,marginTop:3}}>{sub}</div>}
    </Card>
  );
}
function PieChartSVG({data,size=160}){
  const total=data.reduce((s,d)=>s+d.v,0);
  if(total===0) return null;
  const cx=size/2,cy=size/2,r=size/2-8;
  if(data.length===1) return(
    <svg width={size} height={size} style={{display:'block',flexShrink:0}}>
      <circle cx={cx} cy={cy} r={r} fill={data[0].color}/>
    </svg>
  );
  let angle=-Math.PI/2;
  const slices=data.map(d=>{
    const a=(d.v/total)*2*Math.PI;
    const ea=angle+a;
    const x1=cx+r*Math.cos(angle),y1=cy+r*Math.sin(angle);
    const x2=cx+r*Math.cos(ea),y2=cy+r*Math.sin(ea);
    const path=`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${a>Math.PI?1:0},1 ${x2},${y2} Z`;
    angle=ea;
    return {...d,path};
  });
  return(
    <svg width={size} height={size} style={{display:'block',flexShrink:0}}>
      {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={1.5}/>)}
    </svg>
  );
}

/* ── Nav ─────────────────────────────────────────────── */
const LOGO_CANCALE = "data:image/jpeg;base64,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";

const TABS=[
  {id:'dashboard',  icon:'📊',label:'Stats'},
  {id:'catalog',    icon:'📦',label:'Catalogue'},
  {id:'sales',      icon:'💸',label:'Ventes'},
  {id:'invoices',   icon:'🧾',label:'Factures'},
  {id:'stockvinted',icon:'🟢',label:'Stock'},
  {id:'bordereaux', icon:'🖨️',label:'Bordereaux'},
  {id:'garage',     icon:'🏠',label:'Garage'},
  {id:'params',     icon:'⚙️',label:'Comptes'},
];
function Nav({tab,setTab}) {
  return (
    <nav style={{
      position:'fixed',bottom:0,left:0,right:0,zIndex:60,
      background:C.surface,borderTop:`1px solid ${C.border}`,
      boxShadow:'0 -2px 12px rgba(15,28,30,0.06)',
    }}>
      <div style={{display:'flex',justifyContent:'space-around',alignItems:'stretch',maxWidth:700,margin:'0 auto',padding:'6px 4px 8px'}}>
        {TABS.map(t=>{
          const on=tab===t.id;
          return (
            <button key={t.id} type="button" onClick={()=>setTab(t.id)} style={{
              flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,
              padding:'6px 2px',cursor:'pointer',background:'none',border:'none',
              fontFamily:'inherit',color:on?C.accent:C.muted,borderRadius:12,transition:'color .15s',
            }}>
              <div style={{fontSize:19,lineHeight:1,transform:on?'translateY(-2px) scale(1.12)':'none',transition:'transform .15s'}}>{t.icon}</div>
              <div style={{fontSize:9.5,fontWeight:700,letterSpacing:0.2}}>{t.label}</div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ── Sparkline ───────────────────────────────────────── */
function Sparkline({data,color=C.accent,h=60}) {
  if(!data||data.length<2) return null;
  const W=400,H=h;
  const max=Math.max(...data,0.01), min=Math.min(...data,0), range=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*W},${H-((v-min)/range)*(H-10)-5}`).join(' ');
  const area=`0,${H} ${pts} ${W},${H}`;
  const id='g'+color.replace('#','');
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{display:'block'}}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      <polygon points={area} fill={`url(#${id})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Month curve ─────────────────────────────────────── */
function MonthChart({sales}) {
  const monthly=useMemo(()=>{
    const m={};
    sales.forEach(v=>{
      const p=(v.saleDate||''). split('/');
      if(p.length!==3) return;
      const k=p[1]+'/'+p[2];
      if(!m[k]) m[k]={ca:0,profit:0};
      m[k].ca+=+v.sellPrice;
      m[k].profit+=(+v.sellPrice-+v.buyPrice);
    });
    return m;
  },[sales]);
  const keys=Object.keys(monthly).sort((a,b)=>{
    const [ma,ya]=a.split('/'); const [mb,yb]=b.split('/');
    return new Date(ya,ma-1)-new Date(yb,mb-1);
  }).slice(-12);
  if(keys.length<2) return <div style={{color:C.muted,fontSize:13}}>Pas assez de données.</div>;
  const caD=keys.map(k=>monthly[k].ca), pD=keys.map(k=>monthly[k].profit);
  const maxCA=Math.max(...caD,1);
  const W=500,H=120;
  const toP=(data,max)=>data.map((v,i)=>`${(i/(data.length-1))*W},${H-((Math.max(v,0)/max)*(H-16))-8}`).join(' ');
  return (
    <div style={{overflowX:'auto'}}>
      <svg width="100%" viewBox={`0 0 ${W} ${H+24}`} preserveAspectRatio="none" style={{display:'block',minWidth:300}}>
        <defs>
          <linearGradient id="gCA2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity="0.2"/><stop offset="100%" stopColor={C.accent} stopOpacity="0"/></linearGradient>
          <linearGradient id="gP2"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.warn}   stopOpacity="0.2"/><stop offset="100%" stopColor={C.warn}   stopOpacity="0"/></linearGradient>
        </defs>
        <polygon points={`0,${H} ${toP(caD,maxCA)} ${W},${H}`} fill="url(#gCA2)"/>
        <polyline points={toP(caD,maxCA)} fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinejoin="round"/>
        <polygon points={`0,${H} ${toP(pD,maxCA)} ${W},${H}`} fill="url(#gP2)"/>
        <polyline points={toP(pD,maxCA)} fill="none" stroke={C.warn} strokeWidth="2" strokeLinejoin="round" strokeDasharray="5,3"/>
        {keys.map((k,i)=><text key={k} x={(i/(keys.length-1))*W} y={H+16} textAnchor="middle" fill={C.muted} fontSize={8} fontFamily="monospace">{k}</text>)}
        {caD.map((v,i)=><circle key={i} cx={(i/(caD.length-1))*W} cy={H-((Math.max(v,0)/maxCA)*(H-16))-8} r={3} fill={C.accent}/>)}
      </svg>
      <div style={{display:'flex',gap:16,fontSize:11,marginTop:4}}>
        <span style={{color:C.accent}}>— CA</span>
        <span style={{color:C.warn}}>- - Bénéfice</span>
      </div>
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────────── */
// Détail des ventes d'un mois (affiché au clic sur une barre du graphique)
function MonthDetail({mois,type,C,fmt,catMap,catalog,onClose}){
  // Construit le nom de chaque paire depuis le catalogue (si dispo)
  const catName={};
  (catalog||[]).forEach(p=>{ if(p.name) catName[p.id]=p.name; });
  const ventes=[...(mois.ventes||[])].sort((a,b)=>{
    // tri par date (la plus récente d'abord) selon le type de graphique
    const da=(type==='encaisse'?a.receiveDate:a.saleDate)||'';
    const db=(type==='encaisse'?b.receiveDate:b.saleDate)||'';
    return db.localeCompare(da);
  });
  const totalCA=ventes.reduce((s,v)=>s+(+v.sellPrice||0),0);
  const totalProfit=ventes.reduce((s,v)=>s+((+v.sellPrice||0)-(+v.buyPrice||0)),0);
  return (
    <div style={{marginTop:16,padding:14,background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:800,color:C.text}}>{mois.nomComplet} — {ventes.length} vente{ventes.length>1?'s':''}</span>
        <span onClick={onClose} style={{cursor:'pointer',color:C.muted,fontSize:18,fontWeight:700,lineHeight:1}}>×</span>
      </div>
      <div style={{display:'flex',gap:16,marginBottom:12,fontSize:12}}>
        <span style={{color:C.text}}>CA : <b>{fmt(totalCA)}</b></span>
        <span style={{color:C.accent}}>Bénéfice : <b>{fmt(totalProfit)}</b></span>
      </div>
      <div style={{maxHeight:260,overflowY:'auto'}}>
        {ventes.map((v,i)=>{
          const nom=catName[v.productId]||(v.productId?('Paire '+v.productId):'—');
          const dateAff=(type==='encaisse'?v.receiveDate:v.saleDate)||'';
          const benef=(+v.sellPrice||0)-(+v.buyPrice||0);
          return (
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:C.text,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{nom}</div>
                <div style={{color:C.muted,fontSize:10}}>{dateAff}{v.productId?` · n°${v.productId}`:''}</div>
              </div>
              <div style={{textAlign:'right',marginLeft:10}}>
                <div style={{color:C.text,fontWeight:700}}>{fmt(+v.sellPrice||0)}</div>
                <div style={{color:benef>=0?C.accent:C.warn,fontSize:10}}>{benef>=0?'+':''}{fmt(benef)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Dashboard({catalog,sales,garageGrid,invoices,accounts}) {
  // Mois sélectionné au clic sur un graphique (affiche le détail des ventes)
  const [selMonthEnc,setSelMonthEnc]=useState(null);   // graphique encaissé
  const [selMonthVente,setSelMonthVente]=useState(null); // graphique date de vente

  // Paires réellement présentes dans le garage (mémorisé)
  const garageVals=useMemo(()=>
    Object.values(garageGrid).flatMap(a=>Array.isArray(a)?a:[]).filter(v=>v&&v.trim()!=='').map(v=>v.trim()),
  [garageGrid]);
  
  // Map id -> buyPrice depuis le catalogue (mémorisé)
  const catMap=useMemo(()=>{
    const m={};
    catalog.forEach(p=>{m[p.id]=+p.buyPrice;});
    return m;
  },[catalog]);

  const addedAtMap=useMemo(()=>{
    const m={};
    catalog.forEach(p=>{if(p.addedAt&&p.addedAt!=='01/01/2024') m[p.id]=p.addedAt;});
    return m;
  },[catalog]);

  const avgDelayDays=useMemo(()=>{
    const parseD=d=>{if(!d)return null;const p=d.split('/');return p.length===3?new Date(+p[2],+p[1]-1,+p[0]):null;};
    let total=0,count=0;
    sales.forEach(s=>{
      const saleD=parseD(s.saleDate);
      if(!saleD) return;
      const pids=String(s.productId||'').split('+').filter(Boolean);
      pids.forEach(pid=>{
        const addedD=parseD(addedAtMap[pid]);
        if(!addedD) return;
        const days=(saleD-addedD)/(1000*60*60*24);
        if(days>=0){total+=days;count++;}
      });
    });
    return count>0?Math.round(total/count):null;
  },[sales,addedAtMap]);
  
  // Stock & valeur (mémorisés)
  const stockCount=garageVals.length;
  const stockValue=useMemo(()=>garageVals.reduce((s,id)=>s+(catMap[id]||0),0),[garageVals,catMap]);
  const freeSlots=TOTAL_SLOTS-stockCount;
  const fillRate=Math.round((stockCount/TOTAL_SLOTS)*100);
  
  const totalSold=useMemo(()=>catalog.filter(p=>p.status==='vendu').length,[catalog]);
  const encaissees=useMemo(()=>sales.filter(v=>v.receiveDate&&v.receiveDate.trim()!==''),[sales]);
  const ca=useMemo(()=>encaissees.reduce((s,v)=>s+ +v.sellPrice,0),[encaissees]);
  const profit=useMemo(()=>encaissees.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0),[encaissees]);
  const enAttente=useMemo(()=>sales.filter(v=>!v.receiveDate||v.receiveDate.trim()===''),[sales]);
  const caAttente=useMemo(()=>enAttente.reduce((s,v)=>s+ +v.sellPrice,0),[enAttente]);
  const avgX=useMemo(()=>encaissees.length?(encaissees.reduce((s,v)=>s+ +v.multi,0)/encaissees.length).toFixed(2):'—',[encaissees]);
  const avgMargin=ca>0?((profit/ca)*100).toFixed(1):'0';
  const avgSale=encaissees.length?(ca/encaissees.length):0;
  const avgProfit=encaissees.length?(profit/encaissees.length):0;

  const PIE_COLORS=['#1f7a55','#3f7fae','#b07d18','#7a6ad0','#c34a4a','#2aa198','#6c71c4','#d33682','#268bd2','#cb4b16'];

  const brandStats=useMemo(()=>{
    const map={};
    invoices.forEach(inv=>{
      const b=extractBrand(inv.itemName)||extractBrand(inv.productId);
      if(b) map[b]=(map[b]||0)+1;
    });
    sales.forEach(s=>{
      const pid=String(s.productId||'');
      if(!/^\d+(\+\d+)*$/.test(pid.trim())){
        const b=extractBrand(pid);
        if(b) map[b]=(map[b]||0)+1;
      }
    });
    const sorted=Object.entries(map).sort((a,b)=>b[1]-a[1]);
    const top7=sorted.slice(0,7);
    const rest=sorted.slice(7).reduce((s,x)=>s+x[1],0);
    const items=top7.map(([k,v],i)=>({label:k,v,color:PIE_COLORS[i%PIE_COLORS.length]}));
    if(rest>0) items.push({label:'Autre',v:rest,color:'#aaa'});
    return items;
  },[invoices,sales]);

  const countryStats=useMemo(()=>{
    const map={};
    invoices.forEach(inv=>{
      const c=extractCountry(inv.buyerAddress);
      map[c]=(map[c]||0)+1;
    });
    const sorted=Object.entries(map).sort((a,b)=>b[1]-a[1]);
    return sorted.map(([k,v],i)=>({label:k,v,color:PIE_COLORS[i%PIE_COLORS.length]}));
  },[invoices]);

  const weeklyRecapData=useMemo(()=>{
    const today=new Date();
    const day=today.getDay()||7;
    const lastMon=new Date(today);lastMon.setDate(today.getDate()-day-6);lastMon.setHours(0,0,0,0);
    const lastSun=new Date(today);lastSun.setDate(today.getDate()-day);lastSun.setHours(23,59,59,999);
    const parseDt=s=>{if(!s)return null;const p=s.split('/');return p.length===3?new Date(+p[2],+p[1]-1,+p[0]):null;};
    const ventes=encaissees.filter(v=>{const d=parseDt(v.receiveDate);return d&&d>=lastMon&&d<=lastSun;});
    const ca=ventes.reduce((s,v)=>s+ +v.sellPrice,0);
    const profit=ventes.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0);
    return{count:ventes.length,ca,profit,from:lastMon.toLocaleDateString('fr-FR'),to:lastSun.toLocaleDateString('fr-FR')};
  },[encaissees]);

  const monthlyRecapData=useMemo(()=>{
    const today=new Date();
    const prevM=today.getMonth()===0?11:today.getMonth()-1;
    const prevY=today.getMonth()===0?today.getFullYear()-1:today.getFullYear();
    const prevMM=String(prevM+1).padStart(2,'0');
    const prevY4=String(prevY);
    const moisNoms=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const ventes=encaissees.filter(v=>{const p=(v.receiveDate||'').split('/');return p.length===3&&p[1]===prevMM&&p[2]===prevY4;});
    const ca=ventes.reduce((s,v)=>s+ +v.sellPrice,0);
    const profit=ventes.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0);
    return{count:ventes.length,ca,profit,nom:`${moisNoms[prevM]} ${prevY4}`};
  },[encaissees]);

  const isoWeek=getISOWeekKey();
  const monthKey=new Date().toISOString().slice(0,7);
  const [showWeekly,setShowWeekly]=useState(()=>load('vinted_last_weekly_recap','')!==isoWeek);
  const [showMonthly,setShowMonthly]=useState(()=>load('vinted_last_monthly_recap','')!==monthKey);

  // Stats journalières basées sur la date de réception (CA encaissé) (mémorisé)
  const dayStats=useMemo(()=>{
    const ds={};
    encaissees.forEach(v=>{
      const dt=v.receiveDate||'';
      if(!dt) return;
      if(!ds[dt]) ds[dt]={ca:0,count:0,profit:0};
      ds[dt].ca+=+v.sellPrice;
      ds[dt].count++;
      ds[dt].profit+=(+v.sellPrice-+v.buyPrice);
    });
    return ds;
  },[encaissees]);
  const days=useMemo(()=>Object.entries(dayStats),[dayStats]);

  // (Estimation des cotisations URSSAF déplacée après moisCourant, voir plus bas)

  // CA et bénéfice du MOIS EN COURS (basé sur la date de réception JJ/MM/AAAA)
  const moisCourant=useMemo(()=>{
    const now=new Date();
    const mm=String(now.getMonth()+1).padStart(2,'0');
    const yyyy=String(now.getFullYear());
    let caM=0, profitM=0, countM=0;
    encaissees.forEach(v=>{
      const dt=(v.receiveDate||'').trim(); // format attendu JJ/MM/AAAA
      const parts=dt.split('/');
      if(parts.length===3 && parts[1]===mm && parts[2]===yyyy){
        caM+=+v.sellPrice; profitM+=(+v.sellPrice-+v.buyPrice); countM++;
      }
    });
    const labels=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return {ca:caM, profit:profitM, count:countM, nom:labels[now.getMonth()]};
  },[encaissees]);

  // Cotisations + impôt du MOIS EN COURS : 13,5 % du CA encaissé du mois.
  // C'est la somme à payer à la fin du mois (versement libératoire).
  const TAUX_URSSAF=0.135;
  const urssafEstime=moisCourant.ca*TAUX_URSSAF;
  const netApresUrssaf=moisCourant.ca-urssafEstime;

  const bestDayCA=useMemo(()=>[...days].sort((a,b)=>b[1].ca-a[1].ca)[0],[days]);
  const bestDayProfit=useMemo(()=>[...days].sort((a,b)=>b[1].profit-a[1].profit)[0],[days]);
  const avgDayCA=days.length>0?ca/days.length:0;

  // Historique du CA ENCAISSÉ par mois (12 derniers mois, basé sur receiveDate)
  const caHistory=useMemo(()=>{
    const moisCourts=['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc'];
    const moisNoms=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const map={};
    encaissees.forEach(v=>{
      const p=(v.receiveDate||'').trim().split('/');
      if(p.length===3){
        const key=p[2]+'-'+p[1];
        if(!map[key]) map[key]={ca:0,label:moisCourts[parseInt(p[1],10)-1]||p[1],nomComplet:`${moisNoms[parseInt(p[1],10)-1]||p[1]} ${p[2]}`,ventes:[]};
        map[key].ca+=+v.sellPrice;
        map[key].ventes.push(v);
      }
    });
    return Object.keys(map).sort().slice(-12).map(k=>({key:k,label:map[k].label,nomComplet:map[k].nomComplet,ca:map[k].ca,ventes:map[k].ventes}));
  },[encaissees]);

  // Historique du CA par DATE DE VENTE (12 derniers mois, basé sur saleDate)
  const caHistoryVente=useMemo(()=>{
    const moisCourts=['jan','fév','mar','avr','mai','juin','juil','aoû','sep','oct','nov','déc'];
    const moisNoms=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const map={};
    sales.forEach(v=>{
      const p=(v.saleDate||'').trim().split('/');
      if(p.length===3){
        const key=p[2]+'-'+p[1];
        if(!map[key]) map[key]={ca:0,label:moisCourts[parseInt(p[1],10)-1]||p[1],nomComplet:`${moisNoms[parseInt(p[1],10)-1]||p[1]} ${p[2]}`,ventes:[]};
        map[key].ca+=+v.sellPrice;
        map[key].ventes.push(v);
      }
    });
    return Object.keys(map).sort().slice(-12).map(k=>({key:k,label:map[k].label,nomComplet:map[k].nomComplet,ca:map[k].ca,ventes:map[k].ventes}));
  },[sales]);

  // Paires ajoutées par jour (basé sur addedAt JJ/MM/AAAA).
  // On ignore la date d'init "01/01/2024" qui regroupe tout l'historique importé,
  // pour ne montrer que le rythme réel d'ajout jour après jour.
  const ajoutsParJour=useMemo(()=>{
    const map={};
    catalog.forEach(p=>{
      const d=(p.addedAt||'').trim();
      if(!d||d==='01/01/2024') return; // on saute l'historique initial
      const parts=d.split('/');
      if(parts.length!==3) return;
      const key=parts[2]+'-'+parts[1].padStart(2,'0')+'-'+parts[0].padStart(2,'0'); // AAAA-MM-JJ pour tri
      if(!map[key]) map[key]={count:0,label:`${parts[0]}/${parts[1]}`};
      map[key].count++;
    });
    // 30 derniers jours d'activité (ceux qui ont au moins une paire)
    return Object.keys(map).sort().slice(-30).map(k=>({key:k,count:map[k].count,label:map[k].label}));
  },[catalog]);

  // Récap comptable par MOIS (CA encaissé, bénéfice, cotisations + impôt 13,5 %)
  // Basé sur la date d'encaissement car c'est ce qui compte pour l'URSSAF.
  const moisRecap=useMemo(()=>{
    const moisNoms=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const map={};
    encaissees.forEach(v=>{
      const p=(v.receiveDate||'').trim().split('/');
      if(p.length===3){
        const key=p[2]+'-'+p[1];
        if(!map[key]) map[key]={ca:0,profit:0,count:0,annee:p[2],mois:parseInt(p[1],10)};
        map[key].ca+=+v.sellPrice; map[key].profit+=(+v.sellPrice-+v.buyPrice); map[key].count++;
      }
    });
    return Object.keys(map).sort().reverse().map(k=>({
      label:`${moisNoms[map[k].mois-1]||map[k].mois} ${map[k].annee}`,
      ca:map[k].ca, profit:map[k].profit, count:map[k].count,
      urssaf:map[k].ca*0.135, net:map[k].ca-map[k].ca*0.135
    }));
  },[encaissees]);

  // Téléchargement du récap comptable MENSUEL en CSV
  const exportCompta=()=>{
    try{
      const rows=[['Mois','Ventes','CA encaisse','Benefice','Cotisations+impot 13,5%','Net estime']];
      moisRecap.forEach(m=>rows.push([m.label,m.count,m.ca.toFixed(2),m.profit.toFixed(2),m.urssaf.toFixed(2),m.net.toFixed(2)]));
      const csv=rows.map(r=>r.join(';')).join('\n');
      const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url; a.download=`cancale-comptabilite-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }catch(err){ alert('Erreur export : '+err.message); }
  };

  // Carte avec icône et taille
  const StatCard=({icon,label,value,color=C.text,sub,gradient})=>(
    <div style={{
      flex:1,minWidth:140,
      background:gradient||C.card,
      border:`1px solid ${C.border}`,borderRadius:8,padding:'16px 18px',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <span style={{fontSize:18,opacity:0.9}}>{icon}</span>
        <span style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:1.5,fontWeight:600}}>{label}</span>
      </div>
      <div style={{fontSize:22,fontWeight:800,color,lineHeight:1.1,letterSpacing:-0.5}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:C.muted,marginTop:4}}>{sub}</div>}
    </div>
  );

  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:18}}>
      <div>
        <h2 style={{margin:0,color:C.text,fontSize:24,fontWeight:800,letterSpacing:-0.5}}>Tableau de bord</h2>
        <div style={{fontSize:12,color:C.muted,marginTop:2}}>Vue d'ensemble de ton activité</div>
      </div>

      {/* Camemberts */}
      {(brandStats.length>0||countryStats.length>0)&&(
        <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
          {brandStats.length>0&&(
            <Card style={{flex:'1 1 260px'}}>
              <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:12}}>🏷️ Répartition par marque</div>
              <div style={{display:'flex',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
                <PieChartSVG data={brandStats} size={140}/>
                <div style={{flex:1,minWidth:120}}>
                  {brandStats.map((b,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,fontSize:11}}>
                      <div style={{width:10,height:10,borderRadius:2,background:b.color,flexShrink:0}}/>
                      <span style={{color:C.text,fontWeight:700,flex:1}}>{b.label}</span>
                      <span style={{color:C.muted}}>{b.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
          {countryStats.length>0&&(
            <Card style={{flex:'1 1 260px'}}>
              <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:12}}>🌍 Répartition par pays</div>
              <div style={{display:'flex',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
                <PieChartSVG data={countryStats} size={140}/>
                <div style={{flex:1,minWidth:120}}>
                  {countryStats.map((b,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,fontSize:11}}>
                      <div style={{width:10,height:10,borderRadius:2,background:b.color,flexShrink:0}}/>
                      <span style={{color:C.text,fontWeight:700,flex:1}}>{b.label}</span>
                      <span style={{color:C.muted}}>{b.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Stats principales */}
      <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
        <StatCard icon="📦" label="Stock garage" value={stockCount} color={C.accent} sub={`${freeSlots} places libres`}/>
        <StatCard icon="💰" label="Valeur stock" value={fmt(stockValue)} color={C.warn} sub="prix d'achat total"/>
        <StatCard icon="✅" label="Vendues" value={sales.length} color={C.danger}/>
        <StatCard icon="💸" label="CA encaissé" value={fmt(ca)} color={C.text} sub={`${encaissees.length} ventes reçues`}/>
        <StatCard icon="📈" label="Bénéfice net" value={fmt(profit)} color={profit>=0?C.accent:C.danger} sub="argent reçu uniquement"/>
        <StatCard icon="🎯" label="Taux marge" value={`${avgMargin}%`} color={C.blue} sub="bénéf / CA"/>
        {ajoutsParJour.length>0&&<StatCard icon="📦" label="Ajout moyen/jour" value={`${(ajoutsParJour.reduce((s,h)=>s+h.count,0)/ajoutsParJour.length).toFixed(1)}`} color={C.text} sub={`sur ${ajoutsParJour.length}j d'activité`}/>}
        {avgDelayDays!==null&&<StatCard icon="⏱" label="Délai achat → vente" value={`${avgDelayDays}j`} color={C.blue} sub="de l'ajout à la date de vente"/>}
      </div>

      {/* Mois en cours */}
      <Card style={{padding:18,background:C.card,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,color:C.blue,textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:12}}>
          📅 Mois en cours — {moisCourant.nom}
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:18}}>
          <div>
            <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>CA du mois</div>
            <div style={{fontSize:24,fontWeight:800,color:C.text,letterSpacing:-0.5}}>{fmt(moisCourant.ca)}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>Bénéfice du mois</div>
            <div style={{fontSize:24,fontWeight:800,color:moisCourant.profit>=0?C.accent:C.danger,letterSpacing:-0.5}}>{fmt(moisCourant.profit)}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>Ventes</div>
            <div style={{fontSize:24,fontWeight:800,color:C.muted,letterSpacing:-0.5}}>{moisCourant.count}</div>
          </div>
        </div>
      </Card>

      {/* Estimation cotisations du MOIS EN COURS */}
      <Card style={{padding:18,background:C.card,border:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,color:C.warn,textTransform:'uppercase',letterSpacing:1,fontWeight:700,marginBottom:12}}>
          🧾 À payer pour {moisCourant.nom} (13,5 % du CA encaissé)
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:18}}>
          <div>
            <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>Somme à payer ce mois</div>
            <div style={{fontSize:28,fontWeight:800,color:C.warn,letterSpacing:-0.5}}>{fmt(urssafEstime)}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>Net estimé après paiement</div>
            <div style={{fontSize:28,fontWeight:800,color:C.accent,letterSpacing:-0.5}}>{fmt(netApresUrssaf)}</div>
          </div>
        </div>
        <div style={{fontSize:10,color:C.muted,marginTop:10,lineHeight:1.5}}>
          Calculé sur le CA encaissé de {moisCourant.nom} ({fmt(moisCourant.ca)}). C'est la somme à verser à la fin du mois (versement libératoire). Vérifie ton taux sur autoentrepreneur.urssaf.fr — je ne suis pas comptable.
        </div>
      </Card>


      {/* Stats secondaires */}
      <div>
        <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:600,marginBottom:10,paddingLeft:4}}>Détails</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
          <StatCard icon="⭐" label="× moyen" value={`×${avgX}`} color={C.warn}/>
          <StatCard icon="💵" label="Vente moyenne" value={fmt(avgSale)} color={C.text}/>
          <StatCard icon="✨" label="Bénéf. moyen / vente" value={fmt(avgProfit)} color={C.accent}/>
          <StatCard icon="📅" label="CA / jour actif" value={fmt(avgDayCA)} color={C.blue} sub={`${days.length} jours`}/>
        </div>
      </div>

      {/* Records */}
      <div>
        <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:600,marginBottom:10,paddingLeft:4}}>Records</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
          {bestDayCA&&(
            <Card style={{flex:1,minWidth:160,background:C.card,borderColor:C.border}}>
              <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>🏆 Meilleur jour encaissé</div>
              <div style={{fontSize:20,fontWeight:800,color:C.warn}}>{fmt(bestDayCA[1].ca)}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>{bestDayCA[0]} · {bestDayCA[1].count} vente{bestDayCA[1].count>1?'s':''}</div>
            </Card>
          )}
          {bestDayProfit&&(
            <Card style={{flex:1,minWidth:160,background:C.card,borderColor:C.border}}>
              <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>🚀 Meilleur jour bénéfice</div>
              <div style={{fontSize:20,fontWeight:800,color:C.accent}}>{fmt(bestDayProfit[1].profit)}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>{bestDayProfit[0]}</div>
            </Card>
          )}
        </div>
      </div>

      {/* Graphique du CA encaissé par mois (cliquable) */}
      {caHistory.length>0&&(()=>{
        const maxCA=Math.max(...caHistory.map(h=>h.ca),1);
        const sel=caHistory.find(h=>h.key===selMonthEnc);
        return (
          <Card>
            <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:6}}>💰 Évolution du CA encaissé (argent reçu, 12 derniers mois)</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Touche une barre pour voir le détail des ventes du mois.</div>
            <div style={{display:'flex',alignItems:'flex-end',gap:6,height:150,paddingTop:10}}>
              {caHistory.map((h,i)=>{
                const pct=Math.round(h.ca/maxCA*100);
                const actif=h.key===selMonthEnc;
                return (
                  <div key={i} onClick={()=>setSelMonthEnc(actif?null:h.key)}
                       style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6,height:'100%',justifyContent:'flex-end',cursor:'pointer'}}>
                    <div style={{fontSize:9,color:C.muted,fontWeight:700,whiteSpace:'nowrap'}}>{Math.round(h.ca)}</div>
                    <div style={{width:'100%',maxWidth:34,height:`${pct}%`,minHeight:4,background:actif?C.text:C.accent,borderRadius:'3px 3px 0 0',transition:'height .4s',outline:actif?`2px solid ${C.accent}`:'none'}}/>
                    <div style={{fontSize:10,color:actif?C.accent:C.muted,fontWeight:actif?800:600}}>{h.label}</div>
                  </div>
                );
              })}
            </div>
            {sel&&<MonthDetail mois={sel} type="encaisse" C={C} fmt={fmt} catMap={catMap} catalog={catalog} onClose={()=>setSelMonthEnc(null)}/>}
          </Card>
        );
      })()}

      {/* Graphique du CA par date de vente (cliquable) */}
      {caHistoryVente.length>0&&(()=>{
        const maxCA=Math.max(...caHistoryVente.map(h=>h.ca),1);
        const sel=caHistoryVente.find(h=>h.key===selMonthVente);
        return (
          <Card>
            <div style={{fontSize:13,fontWeight:800,color:C.text,marginBottom:6}}>🛒 Évolution du CA par date de vente (12 derniers mois)</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Touche une barre pour voir le détail des ventes du mois.</div>
            <div style={{display:'flex',alignItems:'flex-end',gap:6,height:150,paddingTop:10}}>
              {caHistoryVente.map((h,i)=>{
                const pct=Math.round(h.ca/maxCA*100);
                const actif=h.key===selMonthVente;
                return (
                  <div key={i} onClick={()=>setSelMonthVente(actif?null:h.key)}
                       style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6,height:'100%',justifyContent:'flex-end',cursor:'pointer'}}>
                    <div style={{fontSize:9,color:C.muted,fontWeight:700,whiteSpace:'nowrap'}}>{Math.round(h.ca)}</div>
                    <div style={{width:'100%',maxWidth:34,height:`${pct}%`,minHeight:4,background:actif?C.text:C.blue,borderRadius:'3px 3px 0 0',transition:'height .4s',outline:actif?`2px solid ${C.blue}`:'none'}}/>
                    <div style={{fontSize:10,color:actif?C.blue:C.muted,fontWeight:actif?800:600}}>{h.label}</div>
                  </div>
                );
              })}
            </div>
            {sel&&<MonthDetail mois={sel} type="vente" C={C} fmt={fmt} catMap={catMap} catalog={catalog} onClose={()=>setSelMonthVente(null)}/>}
          </Card>
        );
      })()}


      {/* Récap hebdomadaire */}
      {showWeekly&&weeklyRecapData.count>0&&(
        <Card style={{borderLeft:`4px solid ${C.blue}`,background:`${C.blue}11`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:C.blue,marginBottom:6}}>📅 Récap semaine dernière ({weeklyRecapData.from} → {weeklyRecapData.to})</div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:12}}>
                <span><b style={{color:C.text}}>{weeklyRecapData.count}</b> <span style={{color:C.muted}}>vente{weeklyRecapData.count>1?'s':''}</span></span>
                <span><b style={{color:C.accent}}>{fmt(weeklyRecapData.ca)}</b> <span style={{color:C.muted}}>encaissé</span></span>
                <span><b style={{color:C.accent}}>{fmt(weeklyRecapData.profit)}</b> <span style={{color:C.muted}}>bénéfice</span></span>
              </div>
            </div>
            <button type="button" onClick={()=>{localStorage.setItem('vinted_last_weekly_recap',isoWeek);setShowWeekly(false);}}
              style={{background:'transparent',border:'none',cursor:'pointer',color:C.muted,fontSize:16,lineHeight:1,padding:'2px 4px'}}>✕</button>
          </div>
        </Card>
      )}

      {/* Stats par compte */}
      {accounts&&accounts.length>0&&(()=>{
        const encaissees2=sales.filter(v=>v.receiveDate&&v.receiveDate.trim()!=='');
        return (
          <Card>
            <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:10,fontWeight:700}}>Stats par compte</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
              {accounts.map(acc=>{
                const accSales=encaissees2.filter(v=>v.account===acc.id);
                const accCA=accSales.reduce((s,v)=>s+ +v.sellPrice,0);
                const accProfit=accSales.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0);
                return (
                  <div key={acc.id} style={{flex:'1 1 140px',background:C.bg,borderRadius:8,padding:'10px 14px',border:`1px solid ${acc.color}44`}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                      <span style={{width:10,height:10,borderRadius:'50%',background:acc.color,display:'inline-block'}}/>
                      <span style={{fontSize:12,fontWeight:700,color:C.text}}>{acc.name}</span>
                    </div>
                    <div style={{fontSize:10,color:C.muted}}>CA encaissé</div>
                    <div style={{fontSize:16,fontWeight:800,color:C.text}}>{fmt(accCA)}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:4}}>Bénéfice</div>
                    <div style={{fontSize:14,fontWeight:700,color:accProfit>=0?C.accent:C.danger}}>{fmt(accProfit)}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:4}}>Ventes : <b style={{color:C.text}}>{accSales.length}</b></div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

    </div>
  );
}

/* ── Comptes ─────────────────────────────────────────── */
function AccountsSettings({accounts,setAccounts,appsScriptUrl,setAppsScriptUrl}) {
  const saveAcc=(a)=>{setAccounts(a);save('vinted_accounts',a);};
  const addAcc=()=>{
    const COLORS=['#007782','#e67e22','#9b59b6','#e74c3c','#27ae60','#2980b9','#f39c12','#1abc9c'];
    const usedColors=accounts.map(a=>a.color);
    const color=COLORS.find(c=>!usedColors.includes(c))||COLORS[accounts.length%COLORS.length];
    const newAcc={id:'acc'+Date.now(),name:`Compte ${accounts.length+1}`,color,email:'',pseudo:'',phone:''};
    saveAcc([...accounts,newAcc]);
  };
  const removeAcc=(id)=>{
    if(!window.confirm('Supprimer ce compte ?')) return;
    saveAcc(accounts.filter(a=>a.id!==id));
  };
  const upd=(i,field,val)=>{const a=[...accounts];a[i]={...a[i],[field]:val};saveAcc(a);};
  const inputStyle={background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'6px 10px',fontSize:13,fontFamily:'inherit',outline:'none',width:'100%'};
  const row=(label,field,i,acc,placeholder)=>(
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <span style={{fontSize:11,color:C.muted,whiteSpace:'nowrap',minWidth:80}}>{label}</span>
      <input value={acc[field]||''} onChange={e=>upd(i,field,e.target.value)}
        placeholder={placeholder} style={inputStyle}
        onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
    </div>
  );
  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h2 style={{margin:0,color:C.accent,fontSize:20,fontWeight:800}}>Comptes Vinted</h2>
        <Btn small onClick={addAcc} color={C.accent}>+ Ajouter</Btn>
      </div>
      <Card style={{padding:14,display:'flex',flexDirection:'column',gap:12}}>
        {accounts.length===0&&<div style={{color:C.muted,fontSize:13,textAlign:'center',padding:'10px 0'}}>Aucun compte. Clique sur "+ Ajouter".</div>}
        {accounts.map((acc,i)=>(
          <div key={acc.id} style={{display:'flex',flexDirection:'column',gap:6,padding:'10px 12px',background:C.bg,borderRadius:8,border:`1px solid ${acc.color}44`}}>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="color" value={acc.color} onChange={e=>upd(i,'color',e.target.value)}
                style={{width:32,height:32,border:'none',borderRadius:6,cursor:'pointer',padding:0,background:'none',flexShrink:0}}/>
              <input value={acc.name} onChange={e=>upd(i,'name',e.target.value)}
                placeholder="Nom du compte"
                style={{...inputStyle,fontWeight:700,fontSize:14}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
              <button onClick={()=>removeAcc(acc.id)} style={{background:'transparent',border:'none',color:C.danger,cursor:'pointer',fontSize:18,fontWeight:900,lineHeight:1,padding:'0 4px',flexShrink:0}}>×</button>
            </div>
            {row('Pseudo Vinted :','pseudo',i,acc,'mon_pseudo_vinted')}
            {row('Email iCloud :','email',i,acc,'exemple@icloud.com')}
            {row('Téléphone :','phone',i,acc,'+33 6 00 00 00 00')}
          </div>
        ))}
      </Card>
      {/* URL Apps Script */}
      <Card style={{padding:14,display:'flex',flexDirection:'column',gap:8}}>
        <div style={{fontWeight:700,color:C.text,fontSize:14}}>URL Apps Script</div>
        <div style={{fontSize:12,color:C.muted}}>Nécessaire pour le bouton "Tout imprimer" dans l'onglet Bordereaux. Colle l'URL de déploiement de ton script.</div>
        <input
          value={appsScriptUrl||''}
          onChange={e=>{setAppsScriptUrl(e.target.value.trim());save('vinted_appsscript_url',e.target.value.trim());}}
          placeholder="https://script.google.com/macros/s/.../exec"
          style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'6px 10px',fontSize:12,fontFamily:'inherit',outline:'none',width:'100%'}}
          onFocus={e=>e.target.style.borderColor=C.accent}
          onBlur={e=>e.target.style.borderColor=C.border}
        />
        <div style={{fontSize:11,color:C.muted}}>Dans Apps Script → Déployer → Gérer les déploiements → copie l'URL</div>
      </Card>

      <Card style={{padding:12,fontSize:12,color:C.muted,lineHeight:1.6}}>
        <div style={{fontWeight:700,color:C.text,marginBottom:4}}>Comment ça marche</div>
        L'email iCloud permet la détection automatique du compte dans le script Apps Script. Le pseudo et le téléphone sont pour ta gestion interne. Tout est synchronisé dans le cloud.
      </Card>
    </div>
  );
}

/* ── Catalogue ───────────────────────────────────────── */

function Catalog({catalog,setCatalog,onDeleteId,accounts,photos,setPhotos}) {
  const [searchInput,setSearchInput]=useState('');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [accountFilter,setAccountFilter]=useState('all');
  const [newRow,setNewRow]=useState({id:'',buyPrice:'',account:''});
  const [lastAddedId,setLastAddedId]=useState(null);
  const [photoPreview,setPhotoPreview]=useState(null);
  const priceInputRef=React.useRef(null);
  const [page,setPage]=useState(null);
  const [showAll,setShowAll]=useState(false);
  const [editMode,setEditMode]=useState(false);
  const PER_PAGE=50;
  
  // Recherche : sur Entrée ou bouton
  const triggerSearch=()=>{setSearch(searchInput);setPage(null);};
  const clearSearch=()=>{setSearchInput('');setSearch('');setPage(null);};

  const update=(id,field,val)=>{
    const u=catalog.map(p=>p.id===id?{...p,[field]:field==='buyPrice'?+val:val}:p);
    setCatalog(u); save('vinted_catalog',u);
  };
  const remove=(id)=>{
    if(!window.confirm(`Supprimer #${id} ?`)) return;
    const u=catalog.filter(p=>p.id!==id);
    setCatalog(u); save('vinted_catalog',u);
    if(onDeleteId) onDeleteId(id);
  };
  const toggleStatus=(id)=>{
    const u=catalog.map(p=>p.id===id?{...p,status:p.status==='stock'?'vendu':'stock'}:p);
    setCatalog(u); save('vinted_catalog',u);
  };
  const addRow=()=>{
    const id=newRow.id.trim();
    if(!id||!newRow.buyPrice) return;
    if(catalog.find(p=>p.id===id)){alert('Numéro déjà existant !');return;}
    const u=[...catalog,{id,buyPrice:+newRow.buyPrice,status:'stock',addedAt:tod(),...(newRow.account?{account:newRow.account}:{})}];
    setCatalog(u); save('vinted_catalog',u);
    setLastAddedId(id);
    // Pré-remplit automatiquement le numéro suivant (ex: après 50 → 51 prêt pour le prix)
    let nextId='';
    if(/^\d+$/.test(id)) nextId=String(parseInt(id,10)+1);
    setNewRow({id:nextId,buyPrice:'',account:newRow.account});
    setPage(null); // reste sur la dernière page (où se trouve la ligne d'ajout)
    // Place le curseur sur le champ prix pour enchaîner directement
    setTimeout(()=>{ if(priceInputRef.current) priceInputRef.current.focus(); },50);
  };

  // Bouton +1 : pré-remplit le champ N° avec (dernier n° ajouté + 1).
  // Si rien n'a encore été ajouté dans cette session, part du plus grand n° du catalogue.
  const fillNextId=()=>{
    let base;
    if(lastAddedId!==null && /^\d+$/.test(lastAddedId)){
      base=parseInt(lastAddedId,10);
    } else {
      const nums=catalog.map(p=>parseInt(p.id,10)).filter(n=>!isNaN(n));
      base=nums.length?Math.max(...nums):0;
    }
    setNewRow(r=>({...r,id:String(base+1)}));
    // Place le curseur sur le champ prix pour enchaîner rapidement
    setTimeout(()=>{ if(priceInputRef.current) priceInputRef.current.focus(); },50);
  };

  const fullList=useMemo(()=>catalog
    .filter(p=>p.id.toString().includes(search.trim())&&(filter==='all'||p.status===filter)&&(accountFilter==='all'||p.account===accountFilter))
    .sort((a,b)=>+a.id-+b.id),[catalog,search,filter,accountFilter]);
  const totalPages=Math.max(1,Math.ceil(fullList.length/PER_PAGE));
  const currentPage=page===null?totalPages-1:Math.min(page,totalPages-1);
  const list=showAll?fullList:fullList.slice(currentPage*PER_PAGE,(currentPage+1)*PER_PAGE);


  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      {/* Lightbox photo */}
      {photoPreview&&(
        <div onClick={()=>setPhotoPreview(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.88)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'zoom-out'}}>
          <img src={photoPreview} alt="" style={{maxWidth:'92vw',maxHeight:'88vh',borderRadius:10,boxShadow:'0 8px 40px rgba(0,0,0,0.6)',objectFit:'contain'}}/>
          <button onClick={()=>setPhotoPreview(null)} style={{position:'absolute',top:16,right:18,background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'50%',color:'#fff',fontSize:26,fontWeight:900,width:40,height:40,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
        </div>
      )}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <h2 style={{margin:0,color:C.accent,fontSize:20,fontWeight:800}}>Catalogue ({catalog.length})</h2>
        <Btn small onClick={()=>{
          if(fullList.length===0){alert('Aucune paire à exporter');return;}
          const headers=['N° Paire','Prix Achat (€)','Statut','Date ajout'];
          const rows=fullList.map(p=>[p.id||'',String(p.buyPrice||'').replace('.',','),p.status||'',p.addedAt||'']);
          const csv='\ufeff'+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
          const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
          const url=URL.createObjectURL(blob);
          const a=document.createElement('a');
          a.href=url;
          a.download=`catalogue-${new Date().toISOString().slice(0,10)}.csv`;
          document.body.appendChild(a);a.click();document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }} color={C.blue}>📤 Exporter Excel</Btn>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:6,alignItems:'center',flex:1,minWidth:200}}>
          <Input value={searchInput}
            onChange={e=>setSearchInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
            placeholder="🔍 Numéro... puis Entrée"
            style={{flex:1,minWidth:120}}/>
          <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
          {search&&<Btn small onClick={clearSearch} color={C.border}>✕</Btn>}
        </div>
        {['all','stock','vendu'].map(f=>(
          <Btn key={f} small onClick={()=>setFilter(f)} color={filter===f?C.accent:C.border} style={{color:filter===f?'#fff':C.muted}}>
            {f==='all'?'Tous':f==='stock'?'Stock':'Vendus'}
          </Btn>
        ))}
      </div>
      {accounts&&accounts.length>0&&(
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <Btn key="all" small onClick={()=>setAccountFilter('all')} color={accountFilter==='all'?C.accent:C.border} style={{color:accountFilter==='all'?'#fff':C.muted}}>Tous les comptes</Btn>
          {accounts.map(acc=>(
            <Btn key={acc.id} small onClick={()=>setAccountFilter(acc.id)} color={accountFilter===acc.id?acc.color:C.border} style={{color:accountFilter===acc.id?'#fff':C.muted}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:acc.color,display:'inline-block'}}/>
                {acc.name}
              </span>
            </Btn>
          ))}
        </div>
      )}
      <Card style={{padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:420}}>
          <thead style={{background:C.surface}}><tr>
            {['','N°','Prix achat','Statut','Ajouté','',''].map((h,i)=>(
              <th key={i} style={{textAlign:'left',padding:'10px 12px',color:C.muted,fontWeight:600,fontSize:10,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {list.length===0&&<tr><td colSpan={7} style={{padding:20,textAlign:'center',color:C.muted}}>Aucune paire</td></tr>}
            {list.map(p=>(
              <tr key={p.id} style={{borderTop:`1px solid ${C.border}`,background:(()=>{if(p.status==='vendu') return '#ff4d6d08';if(parseInt(p.id,10)>=1900){const parts=(p.addedAt||'').split('/');if(parts.length===3){const d=new Date(+parts[2],+parts[1]-1,+parts[0]);const days=Math.floor((new Date()-d)/86400000);if(days>60) return `${C.danger}18`;if(days>30) return `${C.warn}18`;}}return 'transparent';})()}}>
                <td style={{padding:'2px 8px',width:70}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                    {(()=>{
                      const photo=photos&&photos[p.id];
                      const photoInputId=`photo-${p.id}`;
                      return (<>
                        <input type="file" accept="image/*" id={photoInputId} style={{display:'none'}}
                          onChange={e=>{
                            const file=e.target.files&&e.target.files[0];
                            if(!file) return;
                            const reader=new FileReader();
                            reader.onload=ev=>{
                              const img=new window.Image();
                              img.onload=()=>{
                                const MAX=600;
                                const sc=Math.min(1,MAX/Math.max(img.width,img.height));
                                const w=Math.round(img.width*sc),h=Math.round(img.height*sc);
                                const canvas=document.createElement('canvas');
                                canvas.width=w;canvas.height=h;
                                canvas.getContext('2d').drawImage(img,0,0,w,h);
                                const dataUrl=canvas.toDataURL('image/jpeg',0.82);
                                const np={...(photos||{}),[p.id]:dataUrl};
                                setPhotos(np);
                                try{localStorage.setItem('vinted_photos',JSON.stringify(np));}catch(_){}
                              };
                              img.src=ev.target.result;
                            };
                            reader.readAsDataURL(file);
                            e.target.value='';
                          }}/>
                        {photo
                          ?<div style={{position:'relative',width:44,height:44,flexShrink:0}}>
                            <img src={photo} alt="" style={{width:44,height:44,objectFit:'cover',borderRadius:5,cursor:'zoom-in',display:'block'}}
                              onClick={()=>setPhotoPreview(photo)} title="Cliquer pour agrandir"/>
                            <button type="button" onClick={()=>{const np={...(photos||{})};delete np[p.id];setPhotos(np);try{localStorage.setItem('vinted_photos',JSON.stringify(np));}catch(_){}}}
                              style={{position:'absolute',top:-5,right:-5,width:16,height:16,borderRadius:'50%',background:C.danger,border:'none',color:'#fff',fontSize:10,fontWeight:900,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1,padding:0}}
                              title="Supprimer la photo">×</button>
                          </div>
                          :<button type="button" onClick={()=>document.getElementById(photoInputId).click()}
                            style={{background:'transparent',border:`1px dashed ${C.border}`,borderRadius:5,color:C.muted,padding:'4px 6px',cursor:'pointer',fontSize:14,lineHeight:1,width:44,height:44,display:'flex',alignItems:'center',justifyContent:'center'}}>📷</button>
                        }
                        <select value={p.account||''} onChange={e=>update(p.id,'account',e.target.value)}
                          style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:5,color:(()=>{const a=accounts&&accounts.find(x=>x.id===p.account);return a?a.color:C.muted;})(),padding:'2px 2px',fontSize:10,width:60,cursor:'pointer',fontWeight:700,outline:'none'}}>
                          <option value="">—</option>
                          {(accounts||[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </>);
                    })()}
                  </div>
                </td>
                <td style={{padding:'2px 12px',fontWeight:800,color:C.accent,fontSize:14,minWidth:60}}>
                  <Cell value={p.id} onChange={v=>update(p.id,'id',v)} mono/>
                </td>
                <td style={{padding:'2px 12px',minWidth:80}}>
                  <Cell value={String(p.buyPrice)} onChange={v=>update(p.id,'buyPrice',v)} align="right"/>
                </td>
                <td style={{padding:'2px 12px'}}>
                  <span onClick={()=>toggleStatus(p.id)} style={{cursor:'pointer'}}>
                    <Badge color={p.status==='stock'?C.accent:C.danger}>{p.status==='stock'?'Stock':'Vendu'}</Badge>
                  </span>
                </td>
                <td style={{padding:'2px 12px',color:C.muted,fontSize:11,minWidth:80}}>
                  <Cell value={p.addedAt||'—'} onChange={v=>update(p.id,'addedAt',v)}/>
                  {p.status==='stock'&&parseInt(p.id,10)>=1900&&(()=>{const parts=(p.addedAt||'').split('/');if(parts.length!==3) return null;const d=new Date(+parts[2],+parts[1]-1,+parts[0]);const days=Math.floor((new Date()-d)/86400000);if(days>30) return <span style={{fontSize:10,color:days>60?C.danger:C.warn,fontWeight:700,marginLeft:3}}>{days}j</span>;return null;})()}
                </td>
                <td style={{padding:'2px 12px'}}>
                  <Btn small danger onClick={()=>remove(p.id)}>✕</Btn>
                </td>
              </tr>
            ))}
            {(showAll||currentPage===totalPages-1)&&<tr style={{borderTop:`2px solid ${C.accent}44`,background:'#00e5a008'}}>
              <td style={{padding:'6px 8px'}}>
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <input value={newRow.id} onChange={e=>setNewRow(n=>({...n,id:e.target.value}))}
                    placeholder="N°" onKeyDown={e=>{if(e.key==='Enter')addRow();}}
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 8px',fontSize:12,width:60,fontFamily:'monospace',outline:'none'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                  <button type="button" onClick={fillNextId} title="Numéro suivant (dernier ajouté +1)"
                    style={{background:`${C.accent}22`,border:`1px solid ${C.accent}66`,borderRadius:6,color:C.accent,padding:'4px 6px',fontSize:14,fontWeight:800,cursor:'pointer',lineHeight:1}}>
                    +1
                  </button>
                </div>
              </td>
              <td style={{padding:'6px 8px'}}>
                <input ref={priceInputRef} value={newRow.buyPrice} onChange={e=>setNewRow(n=>({...n,buyPrice:e.target.value}))}
                  type="number" placeholder="Prix achat €" onKeyDown={e=>{if(e.key==='Enter')addRow();}}
                  style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 8px',fontSize:12,width:100,outline:'none',fontFamily:'inherit'}}
                  onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                />
              </td>
              <td colSpan={2} style={{padding:'6px 8px',color:C.muted,fontSize:11}}>← Entrée ou bouton pour ajouter</td>
              <td style={{padding:'6px 8px'}}>
                <Btn small onClick={addRow} color={C.accent}>+ Ajouter</Btn>
              </td>
            </tr>}
          </tbody>
        </table>
      </Card>
      {/* Pagination Catalogue */}
      {!showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0',flexWrap:'wrap'}}>
        <Btn small onClick={()=>setPage(p=>Math.max(0,(p===null?totalPages-1:p)-1))} color={C.border} style={{opacity:currentPage===0?0.4:1}}>← Précédent</Btn>
        <span style={{color:C.muted,minWidth:120,textAlign:'center'}}>
          Page <b style={{color:C.text}}>{currentPage+1}</b> / {totalPages} <span style={{color:C.muted,fontSize:11}}>({fullList.length} résultats)</span>
        </span>
        <Btn small onClick={()=>setPage(p=>Math.min(totalPages-1,(p===null?totalPages-1:p)+1))} color={C.border} style={{opacity:currentPage>=totalPages-1?0.4:1}}>Suivant →</Btn>
        <Btn small onClick={()=>setShowAll(true)} color={C.warn} style={{color:'#fff',marginLeft:8}}>📋 Voir tout</Btn>
      </div>}
      {showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0'}}>
        <span style={{color:C.warn}}>📋 Affichage complet — {fullList.length} paires</span>
        <Btn small onClick={()=>setShowAll(false)} color={C.border}>Revenir à la pagination</Btn>
      </div>}
    </div>
  );
}

/* ── Ventes ──────────────────────────────────────────── */
function Sales({catalog,setCatalog,sales,setSales,invoices,invoiceSettings,accounts}) {
  const [searchInput,setSearchInput]=useState('');
  const [search,setSearch]=useState('');
  const [newRow,setNewRow]=useState({productId:'',saleDate:'',receiveDate:'',sellPrice:'',buyPrice:'',account:''});
  const [err,setErr]=useState('');
  const [page,setPage]=useState(null); // null = dernière page (init)
  const [showAll,setShowAll]=useState(false);
  const [selectedMonth,setSelectedMonth]=useState('');
  const [groupByAccount,setGroupByAccount]=useState(false);
  const [selectMode,setSelectMode]=useState(false);
  const [selectedIds,setSelectedIds]=useState(new Set());
  const [isDragging,setIsDragging]=useState(false);
  const dragModeRef=React.useRef('add');
  const selectedIdsRef=React.useRef(new Set());
  selectedIdsRef.current=selectedIds;
  const refPid=React.useRef(null);
  const refSaleDate=React.useRef(null);
  const refReceiveDate=React.useRef(null);
  const refBuy=React.useRef(null);
  const refSell=React.useRef(null);
  const PER_PAGE=50;
  const rowRefs=[refPid,refSaleDate,refReceiveDate,refBuy,refSell];
  const navTab=(e,idx)=>{
    if(e.key==='Tab'&&!e.shiftKey){e.preventDefault();const next=rowRefs[idx+1];if(next?.current)next.current.focus();}
    else if(e.key==='Tab'&&e.shiftKey){e.preventDefault();const prev=rowRefs[idx-1];if(prev?.current)prev.current.focus();}
  };
  
  // Recherche : sur Entrée ou bouton
  const triggerSearch=()=>{setSearch(searchInput);setPage(null);};
  const clearSearch=()=>{setSearchInput('');setSearch('');setPage(null);};
  
  // Drag global avec écoute des événements window
  useEffect(()=>{
    if(!selectMode) return;
    
    const onMove=(e)=>{
      if(!isDragging) return;
      const t=e.touches?e.touches[0]:e;
      if(!t) return;
      const el=document.elementFromPoint(t.clientX,t.clientY);
      if(!el) return;
      const tr=el.closest('tr[data-vid]');
      if(!tr) return;
      const vid=tr.getAttribute('data-vid');
      if(!vid) return;
      const ns=new Set(selectedIdsRef.current);
      if(dragModeRef.current==='add') ns.add(vid); else ns.delete(vid);
      // Si pas de changement, on ne re-render pas
      if(ns.size===selectedIdsRef.current.size&&dragModeRef.current==='add'?selectedIdsRef.current.has(vid):!selectedIdsRef.current.has(vid)) return;
      setSelectedIds(ns);
    };
    
    const onUp=()=>setIsDragging(false);
    
    window.addEventListener('mousemove',onMove);
    window.addEventListener('touchmove',onMove,{passive:true});
    window.addEventListener('mouseup',onUp);
    window.addEventListener('touchend',onUp);
    return ()=>{
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('touchmove',onMove);
      window.removeEventListener('mouseup',onUp);
      window.removeEventListener('touchend',onUp);
    };
  },[selectMode,isDragging]);
  


  const updateSale=(id,field,val)=>{
    const u=sales.map(s=>{
      if(s.id!==id) return s;
      const ns={...s,[field]:val};
      const sell=+(field==='sellPrice'?val:ns.sellPrice);
      const buy=+(field==='buyPrice'?val:ns.buyPrice);
      ns.profit=+(sell-buy).toFixed(2);
      ns.multi=buy>0?+(sell/buy).toFixed(2):0;
      return ns;
    });
    setSales(u); save('vinted_sales',u);
  };

  const del=(sid,pid)=>{
    if(!window.confirm('Supprimer cette vente ?')) return;
    const ns=sales.filter(s=>s.id!==sid); setSales(ns); save('vinted_sales',ns);
    const pids=String(pid||'').split('+').map(v=>v.trim()).filter(Boolean);
    const nc=catalog.map(p=>pids.includes(p.id)?{...p,status:'stock'}:p); setCatalog(nc); save('vinted_catalog',nc);
  };

  const addRow=()=>{
    setErr('');
    const rawPid=newRow.productId.trim();
    if(!rawPid||!newRow.saleDate||!newRow.sellPrice){setErr('Article, date et prix vente obligatoires');return;}
    const pids=rawPid.split(/[+,;]+/).map(v=>v.trim()).filter(Boolean);
    const pid=pids.join('+');
    const foundItems=pids.map(id=>catalog.find(x=>x.id===id)).filter(Boolean);
    const buy=foundItems.length>0?foundItems.reduce((s,cp)=>s+(+cp.buyPrice),0):(+newRow.buyPrice||0);
    const sell=+newRow.sellPrice;
    const sale={id:uid(),productId:pid,buyPrice:+buy.toFixed(2),sellPrice:sell,
      profit:+(sell-buy).toFixed(2),multi:buy>0?+(sell/buy).toFixed(2):0,
      saleDate:newRow.saleDate,receiveDate:newRow.receiveDate,createdAt:new Date().toISOString(),
      ...(pids.length>1?{isLot:true}:{})};
    const ns=[sale,...sales]; setSales(ns); save('vinted_sales',ns);
    if(foundItems.length>0){const nc=catalog.map(x=>pids.includes(x.id)?{...x,status:'vendu'}:x);setCatalog(nc);save('vinted_catalog',nc);}
    setNewRow({productId:'',saleDate:'',receiveDate:'',sellPrice:'',buyPrice:''});
    setPage(null);setSelectedMonth('');
    setTimeout(()=>refPid.current&&refPid.current.focus(),50);
  };

  const availableMonths=useMemo(()=>{
    const MOIS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const seen=new Set();
    sales.forEach(s=>{
      const p=(s.receiveDate||'').split('/');
      if(p.length===3&&p[1]&&p[2]) seen.add(p[2]+'-'+p[1].padStart(2,'0'));
    });
    return [...seen].sort().reverse().map(k=>{
      const [y,m]=k.split('-');
      return {key:k,label:`${MOIS[+m-1]} ${y}`};
    });
  },[sales]);

  const fullFiltered=useMemo(()=>{
    const parseD=d=>{if(!d)return 0;const p=d.split('/');return p.length===3?new Date(+p[2],+p[1]-1,+p[0]).getTime():0;};
    let fromTs=0,toTs=Infinity;
    if(selectedMonth){
      const [y,m]=selectedMonth.split('-');
      fromTs=new Date(+y,+m-1,1).getTime();
      toTs=new Date(+y,+m,0,23,59,59,999).getTime();
    }
    return sales.filter(s=>{
      if(s.statut==='en attente') return false; // ventes en attente → onglet Factures
      if(search&&!(s.productId||'').toLowerCase().includes(search.toLowerCase())&&!(s.saleDate||'').includes(search)&&!(s.receiveDate||'').includes(search)) return false;
      if(selectedMonth){
        const rd=parseD(s.receiveDate);
        if(rd<fromTs||rd>toTs) return false;
      }
      return true;
    }).sort((a,b)=>{
      const da=parseD(a.receiveDate)||parseD(a.saleDate);
      const db=parseD(b.receiveDate)||parseD(b.saleDate);
      if(da!==db) return db-da;
      return (a.createdAt||'') < (b.createdAt||'') ? 1 : -1;
    });
  },[sales,search,selectedMonth]);
  const totalPages=Math.max(1,Math.ceil(fullFiltered.length/PER_PAGE));
  const currentPage=page===null?totalPages-1:Math.min(page,totalPages-1);
  const filtered=showAll?fullFiltered:fullFiltered.slice(currentPage*PER_PAGE,(currentPage+1)*PER_PAGE);

  const totalCA=useMemo(()=>fullFiltered.reduce((s,v)=>s+ +v.sellPrice,0),[fullFiltered]);
  const totalProfit=useMemo(()=>fullFiltered.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0),[fullFiltered]);

  const _pids=newRow.productId.trim().split(/[+,;]+/).map(v=>v.trim()).filter(Boolean);
  const p=_pids.length===1?catalog.find(x=>x.id===_pids[0]):null;
  const _foundItems=_pids.map(id=>catalog.find(x=>x.id===id)).filter(Boolean);
  const previewBuy=_foundItems.length>0?_foundItems.reduce((s,x)=>s+(+x.buyPrice),0):(+newRow.buyPrice||null);
  const previewSell=newRow.sellPrice?+newRow.sellPrice:null;

  // CA + bénéfice du mois en cours (basé sur la date de réception JJ/MM/AAAA = argent encaissé)
  const moisVentes=useMemo(()=>{
    const now=new Date();
    const mm=String(now.getMonth()+1).padStart(2,'0');
    const yyyy=String(now.getFullYear());
    let caM=0, profitM=0, countM=0;
    sales.forEach(v=>{
      const dt=(v.receiveDate||'').trim();
      const parts=dt.split('/');
      if(parts.length===3 && parts[1]===mm && parts[2]===yyyy){
        caM+=+v.sellPrice; profitM+=(+v.sellPrice-+v.buyPrice); countM++;
      }
    });
    const labels=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return {ca:caM, profit:profitM, count:countM, nom:labels[now.getMonth()]};
  },[sales]);

  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      {/* Bandeau mois en cours */}
      <div style={{display:'flex',flexWrap:'wrap',gap:14,background:C.card,
        border:`1px solid ${C.blue}44`,borderRadius:8,padding:'12px 16px'}}>
        <div style={{fontSize:11,color:C.blue,textTransform:'uppercase',letterSpacing:1,fontWeight:700,width:'100%'}}>
          📅 {moisVentes.nom} — mois en cours
        </div>
        <div><span style={{fontSize:10,color:C.muted}}>CA encaissé</span><div style={{fontSize:20,fontWeight:800,color:C.text}}>{fmt(moisVentes.ca)}</div></div>
        <div><span style={{fontSize:10,color:C.muted}}>Bénéfice</span><div style={{fontSize:20,fontWeight:800,color:moisVentes.profit>=0?C.accent:C.danger}}>{fmt(moisVentes.profit)}</div></div>
        <div><span style={{fontSize:10,color:C.muted}}>Ventes</span><div style={{fontSize:20,fontWeight:800,color:C.muted}}>{moisVentes.count}</div></div>
      </div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <h2 style={{margin:0,color:C.accent,fontSize:20,fontWeight:800}}>Ventes ({sales.filter(s=>s.statut!=='en attente').length})</h2>
        <div style={{display:'flex',gap:12,fontSize:13,flexWrap:'wrap',alignItems:'center'}}>
          <button onClick={()=>setGroupByAccount(g=>!g)} style={{
            padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',
            background:groupByAccount?C.accent:'transparent',
            color:groupByAccount?'#fff':C.muted,
            border:`1.5px solid ${groupByAccount?C.accent:C.border}`,
          }}>👤 Par compte</button>
          <span style={{color:C.muted}}>CA filtré : <b style={{color:C.text}}>{fmt(totalCA)}</b></span>
          <span style={{color:C.muted}}>Bénéf. : <b style={{color:totalProfit>=0?C.accent:C.danger}}>{fmt(totalProfit)}</b></span>
          <Btn small onClick={()=>{
            if(fullFiltered.length===0){alert('Aucune vente à exporter');return;}
            const headers=['ID','N° Paire','Date vente','Date réception','Prix achat (€)','Prix vente (€)','Bénéfice (€)','Multi'];
            const rows=fullFiltered.map(s=>[
              s.id||'',s.productId||'',s.saleDate||'',s.receiveDate||'',
              String(s.buyPrice||'').replace('.',','),String(s.sellPrice||'').replace('.',','),
              String(s.profit||'').replace('.',','),String(s.multi||'').replace('.',','),
            ]);
            const csv='\ufeff'+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
            const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url;
            a.download=`ventes-${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(a);a.click();document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }} color={C.blue}>📤 Exporter Excel</Btn>
        </div>
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <Input value={searchInput}
          onChange={e=>setSearchInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
          placeholder="🔍 Article, date... puis Entrée"
          style={{maxWidth:280,flex:1,minWidth:160}}/>
        <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
        {search&&<Btn small onClick={clearSearch} color={C.border}>✕</Btn>}
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontSize:11,color:C.muted,fontWeight:600}}>Période :</span>
        <select value={selectedMonth} onChange={e=>{setSelectedMonth(e.target.value);setPage(null);}}
          style={{border:`1px solid ${C.border}`,borderRadius:6,padding:'5px 10px',fontSize:13,background:C.card,color:C.text,cursor:'pointer'}}>
          <option value="">— Tous les mois —</option>
          {availableMonths.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        {selectedMonth&&<Btn small onClick={()=>{setSelectedMonth('');setPage(null);}} color={C.border}>✕</Btn>}
      </div>
      {/* Vue par compte */}
      {groupByAccount&&(()=>{
        const accs=Array.isArray(accounts)?accounts:[];
        // Associe chaque vente à un compte en cherchant dans pseudo, email prefix, ou name
        const matchAcc=(s)=>{
          const c=String(s.compte||'').toLowerCase().trim();
          if(!c) return null;
          return accs.find(a=>
            (a.pseudo&&a.pseudo.toLowerCase()===c)||
            (a.email&&a.email.split('@')[0].toLowerCase()===c)||
            (a.name&&a.name.toLowerCase()===c)
          )||null;
        };
        // Grouper fullFiltered par compte
        const groups={};
        accs.forEach(a=>{ groups[a.id]={acc:a,items:[]}; });
        groups['__autre']={acc:{id:'__autre',name:'Sans compte',color:C.muted},items:[]};
        fullFiltered.forEach(s=>{
          const a=matchAcc(s);
          const key=a?a.id:'__autre';
          if(!groups[key]) groups[key]={acc:a||{id:key,name:key,color:C.muted},items:[]};
          groups[key].items.push(s);
        });
        const grandCA=fullFiltered.reduce((s,v)=>s+(+v.sellPrice||0),0);
        const grandProfit=fullFiltered.reduce((s,v)=>s+(+v.sellPrice||0)-(+v.buyPrice||0),0);
        return (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {[...accs.map(a=>groups[a.id]),groups['__autre']].filter(g=>g&&g.items.length>0).map(({acc,items})=>{
              const ca=items.reduce((s,v)=>s+(+v.sellPrice||0),0);
              const profit=items.reduce((s,v)=>s+(+v.sellPrice||0)-(+v.buyPrice||0),0);
              return (
                <div key={acc.id} style={{borderRadius:12,overflow:'hidden',border:`1.5px solid ${acc.color}44`}}>
                  {/* Header compte */}
                  <div style={{background:acc.color+'22',padding:'10px 14px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                    <div style={{width:10,height:10,borderRadius:'50%',background:acc.color,flexShrink:0}}/>
                    <span style={{fontWeight:800,fontSize:14,color:acc.color}}>{acc.name}</span>
                    <span style={{fontSize:12,color:C.muted,marginLeft:'auto'}}>{items.length} vente{items.length>1?'s':''}</span>
                    <span style={{fontSize:12,fontWeight:700,color:C.text}}>CA : {fmt(ca)}</span>
                    <span style={{fontSize:12,fontWeight:700,color:profit>=0?C.accent:C.danger}}>Bénéf. : {fmt(profit)}</span>
                  </div>
                  {/* Mini-tableau des ventes du compte */}
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                      <thead><tr style={{background:C.surface}}>
                        {['Article','Date vente','Réception €','Achat','Vente','Bénéfice'].map(h=>(
                          <th key={h} style={{padding:'6px 10px',textAlign:'left',color:C.muted,fontWeight:600,fontSize:10,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {items.map(v=>{
                          const b=(+v.sellPrice||0)-(+v.buyPrice||0);
                          return (
                            <tr key={v.id} style={{borderTop:`1px solid ${C.border}`}}>
                              <td style={{padding:'5px 10px',fontWeight:700,color:C.accent}}>{v.productId||'—'}</td>
                              <td style={{padding:'5px 10px',color:C.muted}}>{v.saleDate||'—'}</td>
                              <td style={{padding:'5px 10px',color:C.muted}}>{v.receiveDate||'—'}</td>
                              <td style={{padding:'5px 10px',color:C.text,textAlign:'right'}}>{v.buyPrice!=null?fmt(+v.buyPrice):'—'}</td>
                              <td style={{padding:'5px 10px',color:C.text,textAlign:'right'}}>{v.sellPrice!=null?fmt(+v.sellPrice):'—'}</td>
                              <td style={{padding:'5px 10px',fontWeight:700,color:b>=0?C.accent:C.danger,textAlign:'right'}}>{fmt(b)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {/* Total général */}
            <div style={{background:C.accent+'18',borderRadius:12,padding:'12px 16px',display:'flex',gap:16,flexWrap:'wrap',alignItems:'center',border:`1.5px solid ${C.accent}44`}}>
              <span style={{fontWeight:800,fontSize:14,color:C.accent}}>Total tous comptes</span>
              <span style={{fontSize:13,color:C.muted}}>{fullFiltered.length} vente{fullFiltered.length>1?'s':''}</span>
              <span style={{fontSize:13,fontWeight:700,color:C.text,marginLeft:'auto'}}>CA : {fmt(grandCA)}</span>
              <span style={{fontSize:13,fontWeight:800,color:grandProfit>=0?C.accent:C.danger}}>Bénéfice : {fmt(grandProfit)}</span>
            </div>
          </div>
        );
      })()}

      {!groupByAccount&&<Card style={{padding:0,overflow:'hidden'}}>
        <div className={selectMode?'sales-select-mode':''} style={{overflowX:'auto',position:'relative'}}>
          <style>{`
            .sales-select-mode tbody td > * { pointer-events: none !important; }
            .sales-select-mode tbody tr { pointer-events: auto !important; }
          `}</style>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,
            ...(selectMode?{userSelect:'none',WebkitUserSelect:'none'}:{})}}>
            <thead style={{background:C.surface,position:'sticky',top:0,zIndex:1}}><tr>
              {['Article','Date vente','Réception €','Achat','Vente','Bénéfice','×','Facture',''].map(h=>(
                <th key={h} style={{textAlign:'left',padding:'10px 10px',color:C.muted,fontWeight:600,fontSize:10,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length===0&&<tr><td colSpan={9} style={{padding:20,textAlign:'center',color:C.muted}}>Aucune vente</td></tr>}
              {filtered.map(v=>{
                const b=+(+v.sellPrice-+v.buyPrice);
                const isSelected=selectedIds.has(v.id);
                return (
                  <tr key={v.id}
                    onMouseDown={selectMode?(e)=>{
                      e.preventDefault();
                      const ns=new Set(selectedIds);
                      const willAdd=!ns.has(v.id);
                      if(willAdd) ns.add(v.id); else ns.delete(v.id);
                      setSelectedIds(ns);
                      dragModeRef.current=willAdd?'add':'remove';
                      setIsDragging(true);
                    }:undefined}
                    onTouchStart={selectMode?(e)=>{
                      const ns=new Set(selectedIds);
                      const willAdd=!ns.has(v.id);
                      if(willAdd) ns.add(v.id); else ns.delete(v.id);
                      setSelectedIds(ns);
                      dragModeRef.current=willAdd?'add':'remove';
                      setIsDragging(true);
                    }:undefined}
                    data-vid={v.id}
                    style={{borderTop:`1px solid ${C.border}`,background:isSelected?`${C.accent}33`:'transparent',cursor:selectMode?'pointer':'auto',userSelect:selectMode?'none':'auto',position:'relative'}}>
                    <td style={{padding:'2px 10px',minWidth:100,fontWeight:700,color:C.accent}}>
                      <Cell value={v.productId||''} onChange={val=>updateSale(v.id,'productId',val)}/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:90}}>
                      <Cell value={v.saleDate||''} onChange={val=>updateSale(v.id,'saleDate',val)}/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:90}}>
                      <Cell value={v.receiveDate||''} onChange={val=>updateSale(v.id,'receiveDate',val)}/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:65}}>
                      <Cell value={String(v.buyPrice)} onChange={val=>updateSale(v.id,'buyPrice',val)} align="right"/>
                    </td>
                    <td style={{padding:'2px 10px',minWidth:65}}>
                      <Cell value={String(v.sellPrice)} onChange={val=>updateSale(v.id,'sellPrice',val)} align="right"/>
                    </td>
                    <td style={{padding:'2px 10px',color:b>=0?C.accent:C.danger,fontWeight:800,whiteSpace:'nowrap'}}>{fmt(b)}</td>
                    <td style={{padding:'2px 10px',color:C.warn,whiteSpace:'nowrap'}}>×{fmtN(v.multi)}</td>
                    <td style={{padding:'2px 10px',whiteSpace:'nowrap'}}>
                      {(() => {
                        const inv=invoices&&invoices.find(i=>String(i.productId).trim()===String(v.productId||'').trim());
                        if(!inv) return <span style={{color:C.muted,fontSize:11}}>—</span>;
                        return <button type="button" onClick={()=>generatePDF(inv,invoiceSettings||{companyName:'Shop Cancale35',companyType:'Entrepreneur individuel',companyAddress:'80 rue de la vieille rivière 35260',siret:'94135104100012',footer:'Merci pour votre achat !'})}
                          title={`Voir la facture ${inv.number}`}
                          style={{background:`${C.blue}22`,border:`1px solid ${C.blue}66`,borderRadius:6,color:C.blue,padding:'2px 8px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'monospace'}}>
                          📄 {inv.number}
                        </button>;
                      })()}
                    </td>
                    <td style={{padding:'2px 10px'}}>
                      <Btn small danger onClick={()=>del(v.id,v.productId)}>✕</Btn>
                    </td>
                  </tr>
                );
              })}
              {/* Ligne d'ajout en bas */}
              <tr style={{borderTop:`2px solid ${C.accent}44`,background:'#00e5a008'}}>
                <td style={{padding:'6px 6px'}}>
                  <input ref={refPid} value={newRow.productId} onChange={e=>{
                    const pid=e.target.value;
                    const parts=pid.trim().split(/[+,;]+/).map(v=>v.trim()).filter(Boolean);
                    const inv=parts.length===1?(invoices?invoices.find(i=>String(i.productId).trim()===parts[0]):null):null;
                    setNewRow(n=>({
                      ...n,
                      productId:pid,
                      ...(inv?{saleDate:inv.saleDate||n.saleDate}:{}),
                    }));
                  }}
                    title="N° de la paire (ex: 1974). Pour un lot: 1974+1532" placeholder="N° ou N°+N° (lot)" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();refSell.current&&refSell.current.focus();}else navTab(e,0);}}
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.accent,padding:'4px 6px',fontSize:12,width:90,fontFamily:'monospace',outline:'none',fontWeight:700}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px'}}>
                  <input ref={refSaleDate} value={newRow.saleDate} onChange={e=>setNewRow(n=>({...n,saleDate:e.target.value}))}
                    title="Date à laquelle la vente a été faite sur Vinted (jj/mm/aaaa)" placeholder="jj/mm/aaaa" onKeyDown={e=>navTab(e,1)}
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 6px',fontSize:12,width:90,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px'}}>
                  <input ref={refReceiveDate} value={newRow.receiveDate} onChange={e=>setNewRow(n=>({...n,receiveDate:e.target.value}))}
                    title="Date à laquelle tu as reçu l'argent sur Vinted (jj/mm/aaaa)" placeholder="jj/mm/aaaa" onKeyDown={e=>navTab(e,2)}
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 6px',fontSize:12,width:90,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px'}}>
                  {_foundItems.length>0?<span style={{color:C.muted,fontSize:12,padding:'0 6px'}}>{fmt(previewBuy)}{_foundItems.length>1?<span style={{fontSize:10,color:C.purple,marginLeft:3}}>lot</span>:null}</span>:
                  <input ref={refBuy} value={newRow.buyPrice} onChange={e=>setNewRow(n=>({...n,buyPrice:e.target.value}))}
                    type="number" title="Prix auquel tu as acheté la paire (rempli automatiquement si le n° est dans le catalogue)" placeholder="Achat €" onKeyDown={e=>navTab(e,3)}
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 6px',fontSize:12,width:70,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />}
                </td>
                <td style={{padding:'6px 6px'}}>
                  <input ref={refSell} value={newRow.sellPrice} onChange={e=>setNewRow(n=>({...n,sellPrice:e.target.value}))}
                    type="number" title="Prix auquel tu as vendu la paire sur Vinted. Entrée pour valider." placeholder="Vente €" onKeyDown={e=>{if(e.key==='Enter')addRow();else navTab(e,4);}}
                    style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,color:C.text,padding:'4px 6px',fontSize:12,width:70,outline:'none',fontFamily:'inherit'}}
                    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </td>
                <td style={{padding:'6px 6px',color:previewBuy!==null&&previewSell!==null?(previewSell-previewBuy>=0?C.accent:C.danger):C.muted,fontWeight:800,fontSize:12,whiteSpace:'nowrap'}}>
                  {previewBuy!==null&&previewSell!==null?fmt(previewSell-previewBuy):''}
                </td>
                <td style={{padding:'6px 6px',color:C.warn,fontSize:12}}>
                  {previewBuy&&previewBuy>0&&previewSell?`×${(previewSell/previewBuy).toFixed(2)}`:''}
                </td>
                <td style={{padding:'6px 6px'}}>
                  <Btn small onClick={addRow} color={C.accent}>+ Ajouter</Btn>
                </td>
              </tr>
              {err&&<tr><td colSpan={8} style={{padding:'6px 12px',color:C.danger,fontSize:12}}>⚠ {err}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>}
      {/* Pagination */}
      {!groupByAccount&&!showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0',flexWrap:'wrap'}}>
        <Btn small onClick={()=>setPage(p=>Math.max(0,(p===null?totalPages-1:p)-1))} color={C.border} style={{opacity:currentPage===0?0.4:1}}>← Précédent</Btn>
        <span style={{color:C.muted,minWidth:120,textAlign:'center'}}>
          Page <b style={{color:C.text}}>{currentPage+1}</b> / {totalPages} <span style={{color:C.muted,fontSize:11}}>({fullFiltered.length} résultats)</span>
        </span>
        <Btn small onClick={()=>setPage(p=>Math.min(totalPages-1,(p===null?totalPages-1:p)+1))} color={C.border} style={{opacity:currentPage>=totalPages-1?0.4:1}}>Suivant →</Btn>
        <Btn small onClick={()=>setShowAll(true)} color={C.warn} style={{color:'#fff',marginLeft:8}}>📋 Voir tout</Btn>
      </div>}
      {!groupByAccount&&showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0'}}>
        <span style={{color:C.warn}}>📋 Affichage complet — {fullFiltered.length} ventes</span>
        <Btn small onClick={()=>setShowAll(false)} color={C.border}>Revenir à la pagination</Btn>
      </div>}
      
      {/* Barre flottante en bas : bouton sélection + somme */}
      <div style={{position:'sticky',bottom:0,zIndex:20,padding:'8px 0',background:`linear-gradient(180deg, transparent 0%, ${C.bg} 30%)`}}>
        <Card style={{padding:'10px 14px',display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',background:selectMode?`${C.accent}15`:C.card,borderColor:selectMode?`${C.accent}66`:C.border}}>
          <Btn small onClick={()=>{setSelectMode(!selectMode);if(selectMode)setSelectedIds(new Set());}} color={selectMode?C.accent:C.border} style={{color:selectMode?'#fff':C.muted}}>
            {selectMode?'✓ Mode sélection actif':'☑️ Activer la sélection'}
          </Btn>
          {selectMode&&<>
            <span style={{fontSize:11,color:C.muted}}>
              {selectedIds.size===0?'Clique ou glisse sur les lignes du tableau pour les sélectionner':`${selectedIds.size} vente${selectedIds.size>1?'s':''} sélectionnée${selectedIds.size>1?'s':''}`}
            </span>
            {selectedIds.size>0&&(()=>{
              const sel=fullFiltered.filter(v=>selectedIds.has(v.id));
              const sumCA=sel.reduce((s,v)=>s+ +v.sellPrice,0);
              const sumProfit=sel.reduce((s,v)=>s+(+v.sellPrice-+v.buyPrice),0);
              const sumRecu=sel.filter(v=>v.receiveDate&&v.receiveDate.trim()!=='').reduce((s,v)=>s+ +v.sellPrice,0);
              return (<>
                <span style={{fontSize:13,color:C.muted,marginLeft:'auto'}}>Σ : <b style={{color:C.text}}>{fmt(sumCA)}</b></span>
                <span style={{fontSize:13,color:C.muted}}>💰 Reçu : <b style={{color:C.accent}}>{fmt(sumRecu)}</b></span>
                <span style={{fontSize:13,color:C.muted}}>Bénéf. : <b style={{color:sumProfit>=0?C.accent:C.danger}}>{fmt(sumProfit)}</b></span>
              </>);
            })()}
          </>}
        </Card>
      </div>
    </div>
  );
}

/* ── Box & Door ──────────────────────────────────────── */
const Box = React.memo(function Box({val,isSold,highlight}) {
  const W=46,H=26,SW=6,TH=5;
  const hasVal=val&&val.trim()!=='';
  // Cases vides : rendu ultra simple, pas de SVG complexe
  if(!hasVal&&!highlight){
    return (
      <svg width={W+SW} height={H+TH} style={{display:'block'}}>
        <rect x={0} y={TH} width={W} height={H} rx={2} fill="#2e2e2e"/>
      </svg>
    );
  }
  let front,side,top,textCol;
  if(isSold)      {front='#8a1a2a';side='#5a0e1a';top='#aa2535';textCol='#ffaaaa';}
  else if(hasVal) {front='#b07830';side='#7a5218';top='#d09040';textCol='#2a1200';}
  else            {front='#2e2e2e';side='#1e1e1e';top='#3a3a3a';textCol='transparent';}
  return (
    <svg width={W+SW} height={H+TH} style={{display:'block',overflow:'visible',
      filter:highlight?'drop-shadow(0 0 8px #ffb830) drop-shadow(0 0 16px #ffb830) brightness(1.5)':'none'}}>
      {highlight&&<rect x={-2} y={TH-2} width={W+4} height={H+4} rx={3} fill="none" stroke="#ffb830" strokeWidth="2.5"/>}      <polygon points={`0,${TH} ${SW},0 ${W+SW},0 ${W},${TH}`} fill={top} stroke="#111" strokeWidth="0.6"/>
      <rect x={0} y={TH} width={W} height={H} rx={2} fill={front} stroke="#111" strokeWidth="0.6"/>
      <polygon points={`${W},${TH} ${W+SW},0 ${W+SW},${H} ${W},${H+TH}`} fill={side} stroke="#111" strokeWidth="0.6"/>
      {hasVal&&<rect x={8} y={TH+H/2-2} width={W-16} height={4} rx={1} fill={side} opacity="0.6"/>}
      {hasVal&&<text x={W/2} y={TH+H/2+4} textAnchor="middle" fill={textCol} fontSize={8} fontWeight="800" fontFamily="monospace">{val.trim()}</text>}
    </svg>
  );
});
function Door({h}) {
  const W=80,H=h;
  return (
    <svg width={W} height={H} style={{display:'block',flexShrink:0}}>
      <rect width={W} height={H} fill="#3a2a1a"/>
      <rect x={4} y={4} width={W-8} height={H-4} rx={3} fill="#6a4828"/>
      <rect x={8} y={8} width={W-16} height={H-12} rx={2} fill="#c8a060"/>
      <rect x={13} y={14} width={W-26} height={H*0.28} rx={2} fill="#b08848" stroke="#7a5820" strokeWidth="0.8"/>
      <rect x={18} y={18} width={W-36} height={H*0.28-8} rx={1} fill="#88b8d8" opacity="0.4"/>
      <rect x={13} y={14+H*0.28+8} width={W-26} height={H*0.42} rx={2} fill="#b08848" stroke="#7a5820" strokeWidth="0.8"/>
      <circle cx={W-16} cy={H*0.56} r={5} fill="#d4a820" stroke="#8a6800" strokeWidth="1"/>
      <circle cx={W-16} cy={H*0.56} r={2} fill="#ffe060"/>
      <rect x={10} y={H*0.18} width={7} height={12} rx={1} fill="#4a3010"/>
      <rect x={10} y={H*0.72} width={7} height={12} rx={1} fill="#4a3010"/>
      <rect x={0} y={H-6} width={W} height={6} fill="#2a1a08"/>
    </svg>
  );
}

/* ── Factures ───────────────────────────────────────── */
function Invoices({invoices,setInvoices,catalog,sales,setSales,invoiceSettings,setInvoiceSettings}) {
  const [searchInput,setSearchInput]=useState('');
  const [search,setSearch]=useState('');
  const [zone,setZone]=useState('ventes_attente'); // 'ventes_attente' | 'ventes_finalisees' | 'attente' | 'comptabilisees'
  const [page,setPage]=useState(null);
  const [showAll,setShowAll]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [fetching,setFetching]=useState(false);
  const PER_PAGE=50;
  
  // URL de l'API Apps Script (Vinted Auto)
  const VINTED_API_URL='https://script.google.com/macros/s/AKfycbzO-jwmFwOwJI49W0LjR8EOcIKAWsTzElWsWc6IVg0luX6MhbJNdOXzpe2BhYUCXmHb/exec';
  
  // Récupère les factures depuis Google Sheets via Apps Script
  // silencieux = true : pas d'alertes (utilisé pour le rafraîchissement auto au démarrage)
  const fetchVintedInvoices=async(silencieux=false)=>{
    setFetching(true);
    try {
      const res=await fetch(VINTED_API_URL);
      const data=await res.json();
      if(!Array.isArray(data)){
        if(!silencieux) alert('Format de données inattendu');
        return;
      }
      // Convertir les lignes Sheets en factures de l'app
      const existingKeys=new Set(invoices.map(i=>`${i.productId}|${i.sellPrice}|${i.buyerName}`));
      // Point de départ pour la numérotation auto : max des numéros existants de l'année
      const year=new Date().getFullYear();
      let maxNum=invoices.reduce((mx,i)=>{
        if(i.number&&i.number.startsWith(`${year}-`)){
          const n=parseInt(i.number.split('-')[1],10);
          return isNaN(n)?mx:Math.max(mx,n);
        }
        return mx;
      },0);
      const newInvoices=[];
      data.forEach(row=>{
        const productId=String(row['N° paire']||'').trim();
        const designation=String(row['Désignation']||'').trim();
        const prix=row['Prix'];
        const pseudo=String(row['Pseudo']||'').trim();
        const nomComplet=String(row['Nom complet']||'').trim();
        const email=String(row['Email']||'').trim();
        const adresse=String(row['Adresse']||'').trim();
        const dateMail=row['Date mail'];
        
        if(!pseudo||!prix) return; // données incomplètes
        
        const key=`${productId}|${prix}|${nomComplet}`;
        if(existingKeys.has(key)) return; // déjà importé
        
        // Attribue un numéro de facture dès l'arrivée (la facture reste en Boîte de réception à valider)
        maxNum+=1;
        const autoNumber=`${year}-${String(maxNum).padStart(6,'0')}`;
        
        newInvoices.push({
          id:'inv_auto_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
          number:autoNumber, // numéro déjà attribué
          productId:productId,
          itemName:designation,
          sellPrice:String(prix),
          saleDate:dateMail?new Date(dateMail).toISOString().slice(0,10):'',
          buyerName:nomComplet,
          buyerEmail:email,
          buyerAddress:adresse,
          vintedNumber:'',
          source:'auto',
          validated:false,
          pseudo:pseudo,
          createdAt:new Date().toISOString(),
        });
      });
      
      if(newInvoices.length===0){
        if(!silencieux) alert('Aucune nouvelle facture à importer');
      } else {
        const u=[...newInvoices,...invoices];
        setInvoices(u); save('vinted_invoices',u);
        if(!silencieux) alert(`✓ ${newInvoices.length} nouvelle(s) facture(s) importée(s) depuis Vinted !`);
      }
    } catch(err) {
      if(!silencieux) alert('Erreur récupération : '+err.message);
    } finally {
      setFetching(false);
    }
  };

  // 🔄 Rafraîchissement automatique au démarrage (silencieux) + toutes les 5 min
  const _autoFetchedRef=React.useRef(false);
  useEffect(()=>{
    if(_autoFetchedRef.current) return;
    _autoFetchedRef.current=true;
    // Premier chargement au démarrage de l'onglet Factures
    fetchVintedInvoices(true);
    // Puis toutes les 5 minutes tant que l'app est ouverte
    const interval=setInterval(()=>fetchVintedInvoices(true), 5*60*1000);
    return ()=>clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  
  // Numéro auto pour la prochaine facture
  const nextInvoiceNumber=useMemo(()=>{
    const year=new Date().getFullYear();
    const yearInvoices=invoices.filter(i=>i.number&&i.number.startsWith(`${year}-`));
    const maxNum=yearInvoices.reduce((mx,i)=>{
      const n=parseInt(i.number.split('-')[1],10);
      return isNaN(n)?mx:Math.max(mx,n);
    },0);
    return `${year}-${String(maxNum+1).padStart(6,'0')}`;
  },[invoices]);
  
  // Set des productIds qui sont déjà dans Ventes (= comptabilisés)
  const accountedSet=useMemo(()=>{
    const s=new Set();
    sales.forEach(v=>{
      if(v.productId) String(v.productId).trim().split('+').forEach(id=>{const t=id.trim();if(t) s.add(t);});
    });
    return s;
  },[sales]);
  
  const triggerSearch=()=>{setSearch(searchInput);setPage(null);};
  const clearSearch=()=>{setSearchInput('');setSearch('');setPage(null);};
  
  // Filtrage par zone + recherche
  const fullList=useMemo(()=>{
    let list=invoices;
    // Si une recherche est active, on cherche dans TOUTES les zones (pratique pour retrouver/supprimer une facture)
    if(search.trim()){
      const q=search.trim().toLowerCase();
      list=list.filter(i=>(i.number||'').toLowerCase().includes(q)||
        String(i.productId||'').toLowerCase().includes(q)||
        (i.itemName||'').toLowerCase().includes(q)||
        (i.buyerName||'').toLowerCase().includes(q)||
        fmtDate(i.saleDate||'').toLowerCase().includes(q)||
        String(i.saleDate||'').toLowerCase().includes(q));
      return [...list].sort((a,b)=>(b.saleDate||'').localeCompare(a.saleDate||''));
    }
    // Sinon, filtrage normal par zone
    if(zone==='attente') list=list.filter(i=>!accountedSet.has(String(i.productId).trim()));
    else if(zone==='comptabilisees') list=list.filter(i=>accountedSet.has(String(i.productId).trim()));
    return [...list].sort((a,b)=>(b.saleDate||'').localeCompare(a.saleDate||''));
  },[invoices,zone,search,accountedSet]);
  
  const totalPages=Math.max(1,Math.ceil(fullList.length/PER_PAGE));
  const currentPage=page===null?0:Math.min(page,totalPages-1);
  const list=showAll?fullList:fullList.slice(currentPage*PER_PAGE,(currentPage+1)*PER_PAGE);
  
  // Compteurs par zone
  const counters=useMemo(()=>{
    const attente=invoices.filter(i=>!accountedSet.has(String(i.productId).trim())).length;
    const comptabilisees=invoices.filter(i=>accountedSet.has(String(i.productId).trim())).length;
    const ventes_attente=(Array.isArray(sales)?sales:[]).filter(s=>s.statut==='en attente').length;
    const ventes_finalisees=(Array.isArray(sales)?sales:[]).filter(s=>s.statut==='finalisée').length;
    return {attente,comptabilisees,ventes_attente,ventes_finalisees};
  },[invoices,accountedSet,sales]);
  
  const deleteInvoice=(id)=>{
    const inv=invoices.find(i=>i.id===id);
    const isAcc=inv&&accountedSet.has(String(inv.productId).trim());
    const msg=isAcc
      ? `⚠️ La paire #${inv.productId} a une vente saisie dans ta compta.\nSupprimer cette facture quand même ?`
      : 'Supprimer cette facture ?';
    if(!window.confirm(msg)) return;
    const u=invoices.filter(i=>i.id!==id);
    setInvoices(u); save('vinted_invoices',u);
  };
  
  const addInvoice=(data)=>{
    const newInvoice={
      id:'inv_'+Date.now(),
      number:nextInvoiceNumber,
      ...data,
      createdAt:new Date().toISOString(),
    };
    const u=[newInvoice,...invoices];
    setInvoices(u); save('vinted_invoices',u);
    setShowForm(false);
  };
  
  // Export CSV/Excel
  const exportExcel=()=>{
    if(fullList.length===0){alert('Aucune facture à exporter');return;}
    const headers=['N° Facture','Date vente','N° Paire','Désignation','Prix vente','Acheteur','Email','Adresse','N° Vinted','Statut'];
    const rows=fullList.map(i=>[
      i.number||'',i.saleDate||'',i.productId||'',i.itemName||'',
      (i.sellPrice||'').toString().replace('.',','),
      i.buyerName||'',i.buyerEmail||'',i.buyerAddress||'',i.vintedNumber||'',
      accountedSet.has(String(i.productId).trim())?'Comptabilisée':'En attente',
    ]);
    const csv='\ufeff'+[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`factures-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <h2 style={{margin:0,color:C.accent,fontSize:20,fontWeight:800}}>Factures ({invoices.length})</h2>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <Btn small onClick={()=>setShowForm(true)} color={C.accent}>+ Nouvelle facture</Btn>
          <Btn small onClick={exportExcel} color={C.blue}>📤 Exporter Excel</Btn>
          <Btn small onClick={()=>setShowSettings(true)} color={C.border}>⚙ Réglages</Btn>
        </div>
      </div>
      
      {/* Barre de recherche : par n° de paire ou date de vente (cherche dans toutes les zones) */}
      <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
        <input
          value={searchInput}
          onChange={e=>setSearchInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
          placeholder="🔍 N° de paire ou date de vente... puis Entrée"
          style={{flex:1,minWidth:200,padding:'9px 12px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,
            color:C.text,fontSize:13,fontFamily:'inherit',outline:'none'}}
        />
        <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
        {search&&<Btn small onClick={clearSearch} color={C.border}>✕ Effacer</Btn>}
      </div>
      {search&&<div style={{fontSize:12,color:C.warn}}>
        🔍 Recherche « {search} » dans toutes les factures — {fullList.length} résultat{fullList.length>1?'s':''}. Tu peux supprimer directement avec 🗑.
      </div>}
      
      {/* Sous-onglets zones */}
      <div style={{display:'flex',gap:0,borderBottom:`1px solid ${C.border}`,overflowX:'auto',opacity:search?0.4:1,pointerEvents:search?'none':'auto'}}>
        {[
          {id:'ventes_attente',icon:'⏳',label:'En attente',count:counters.ventes_attente},
          {id:'attente',icon:'🧾',label:'Factures',count:counters.attente},
          {id:'comptabilisees',icon:'✅',label:'Comptabilisées',count:counters.comptabilisees},
        ].map(z=>(
          <button key={z.id} type="button" onClick={()=>{setZone(z.id);setPage(null);}}
            style={{background:'transparent',border:'none',borderBottom:zone===z.id?`3px solid ${C.accent}`:'3px solid transparent',
              color:zone===z.id?C.accent:C.muted,padding:'8px 14px',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'inherit',whiteSpace:'nowrap'}}>
            {z.icon} {z.label} ({z.count})
          </button>
        ))}
      </div>

      {/* Ventes Gmail : En attente / Finalisées */}
      {zone==='ventes_attente'&&(()=>{
        const gmailSales=(Array.isArray(sales)?sales:[]).filter(s=>s.statut==='en attente'
        ).sort((a,b)=>{
          const ta=a.saleDate?a.saleDate.split('/').reverse().join('-'):'';
          const tb=b.saleDate?b.saleDate.split('/').reverse().join('-'):'';
          return tb.localeCompare(ta);
        });
        const fmt2=v=>v!=null&&v!==''?`${(+v).toFixed(2)} €`:'—';
        return (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {gmailSales.length===0&&(
              <div style={{textAlign:'center',color:C.muted,padding:'32px 0',fontSize:13}}>
                Aucune vente en attente. Les ventes Vinted apparaissent ici dès la sync.
              </div>
            )}
            {gmailSales.map(s=>{
              const canDelete=zone==='ventes_attente';
              return (
                <div key={s.id} style={{
                  background:C.card,border:`1px solid ${C.border}`,borderRadius:10,
                  padding:'12px 14px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',
                }}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:3}}>
                      <span style={{fontWeight:800,fontSize:13,color:C.accent}}>N°{s.numero||s.productId||'?'}</span>
                      <span style={{fontSize:12,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:200}}>{s.productId||<span style={{color:C.muted,fontStyle:'italic'}}>Modèle inconnu</span>}</span>
                    </div>
                    <div style={{fontSize:11,color:C.muted,display:'flex',gap:12,flexWrap:'wrap'}}>
                      {s.saleDate&&<span>📅 Vente : {s.saleDate}</span>}
                      {s.receiveDate&&<span>💳 Reçu : {s.receiveDate}</span>}
                        </div>
                  </div>
                  {canDelete&&<button onClick={()=>{
                    if(!window.confirm('Supprimer cette vente en attente ?')) return;
                    const u=(Array.isArray(sales)?sales:[]).filter(x=>x.id!==s.id);
                    setSales(u); save('vinted_sales',u);
                  }} style={{padding:'6px 10px',borderRadius:8,background:'transparent',color:C.danger,border:`1px solid ${C.danger}`,fontSize:12,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>🗑️</button>}
                </div>
              );
            })}
          </div>
        );
      })()}
      
      {/* Recherche */}
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <Input value={searchInput}
          onChange={e=>setSearchInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
          placeholder="🔍 N° paire, date de vente, acheteur, n° facture..."
          style={{flex:1,minWidth:120}}/>
        <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
        {search&&<Btn small onClick={clearSearch} color={C.border}>✕</Btn>}
      </div>
      {search.trim()&&<div style={{fontSize:11,color:C.warn,marginTop:6}}>🔍 Recherche active dans toutes les factures.</div>}
      
      {/* Tableau factures */}
      <Card style={{padding:0,overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:700}}>
          <thead>
            <tr style={{background:C.surface,borderBottom:`1px solid ${C.border}`}}>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.warn,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>N° Paire</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>N° Facture</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>Date vente</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>Désignation</th>
              <th style={{padding:'10px 8px',textAlign:'right',color:C.muted,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>Prix</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.muted,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>Acheteur</th>
              <th style={{padding:'10px 8px',textAlign:'right',color:C.muted,fontWeight:700,fontSize:10,letterSpacing:0.5,textTransform:'uppercase'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.length===0&&<tr><td colSpan={7} style={{padding:30,textAlign:'center',color:C.muted}}>{search.trim()?`Aucune facture trouvée pour « ${search} »`:`Aucune facture ${zone==='attente'?'en attente':'comptabilisée'}`}</td></tr>}
            {list.map(inv=>{
              const isAccounted=accountedSet.has(String(inv.productId).trim());
              return (
                <tr key={inv.id} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:'8px',color:C.warn,fontWeight:800,fontFamily:'monospace',fontSize:15}}>#{inv.productId||'?'}</td>
                  <td style={{padding:'8px',color:C.accent,fontWeight:700,fontFamily:'monospace',fontSize:11}}>{inv.number||'—'}</td>
                  <td style={{padding:'8px',color:C.text,fontFamily:'monospace',fontSize:11}}>{fmtDate(inv.saleDate)}</td>
                  <td style={{padding:'8px',color:C.text}}>{String(inv.itemName||'—').replace(/\bimages?\s*:\s*/gi,'').replace(/\bimages?\b/gi,'').replace(/\s+/g,' ').trim()||'—'}</td>
                  <td style={{padding:'8px',textAlign:'right',color:C.accent,fontWeight:700}}>{fmt(+inv.sellPrice||0)}</td>
                  <td style={{padding:'8px',color:C.muted,fontSize:11}}>{inv.buyerName||'—'}</td>
                  <td style={{padding:'8px',textAlign:'right',whiteSpace:'nowrap'}}>
                    <Btn small onClick={()=>generatePDF(inv,invoiceSettings)} color={C.blue} style={{marginRight:4}}>📄</Btn>
                    <Btn small onClick={()=>deleteInvoice(inv.id)} color={C.danger}>🗑</Btn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      
      {/* Pagination */}
      {!showAll&&totalPages>1&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0',flexWrap:'wrap'}}>
        <Btn small onClick={()=>setPage(p=>Math.max(0,(p===null?0:p)-1))} color={C.border} style={{opacity:currentPage===0?0.4:1}}>← Précédent</Btn>
        <span style={{color:C.muted,minWidth:120,textAlign:'center'}}>
          Page <b style={{color:C.text}}>{currentPage+1}</b> / {totalPages} <span style={{color:C.muted,fontSize:11}}>({fullList.length} résultats)</span>
        </span>
        <Btn small onClick={()=>setPage(p=>Math.min(totalPages-1,(p===null?0:p)+1))} color={C.border} style={{opacity:currentPage>=totalPages-1?0.4:1}}>Suivant →</Btn>
        <Btn small onClick={()=>setShowAll(true)} color={C.warn} style={{color:'#fff',marginLeft:8}}>📋 Voir tout</Btn>
      </div>}
      {showAll&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,fontSize:12,padding:'4px 0'}}>
        <span style={{color:C.warn}}>📋 Affichage complet — {fullList.length} factures</span>
        <Btn small onClick={()=>setShowAll(false)} color={C.border}>Revenir à la pagination</Btn>
      </div>}
      
      {/* Modale création facture */}
      {showForm&&<InvoiceForm onClose={()=>setShowForm(false)} onSave={addInvoice} nextNumber={nextInvoiceNumber} catalog={catalog}/>}
      
      {/* Modale réglages */}
      {showSettings&&<InvoiceSettings settings={invoiceSettings} setSettings={(s)=>{setInvoiceSettings(s);save('vinted_invoice_settings',s);}} onClose={()=>setShowSettings(false)}/>}
    </div>
  );
}

// Formulaire de création d'une facture
function InvoiceForm({onClose,onSave,nextNumber,catalog}) {
  const [data,setData]=useState({
    productId:'',itemName:'',sellPrice:'',saleDate:tod(),
    buyerName:'',buyerEmail:'',buyerAddress:'',
    vintedNumber:'',source:'manual',
  });
  const [err,setErr]=useState('');
  
  const submit=()=>{
    setErr('');
    if(!data.productId.trim()){setErr('Le numéro de paire est obligatoire');return;}
    if(!data.sellPrice||+data.sellPrice<=0){setErr('Prix de vente invalide');return;}
    if(!data.itemName.trim()){setErr('La désignation est obligatoire');return;}
    onSave(data);
  };
  
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:20,maxWidth:480,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <h3 style={{margin:0,color:C.accent}}>Nouvelle facture</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer',padding:0}}>×</button>
        </div>
        <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Numéro auto : <b style={{color:C.accent}}>{nextNumber}</b></div>
        
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Field label="N° paire (étiquetage) *">
            <Input type="number" value={data.productId} onChange={e=>{
              const id=e.target.value;
              const p=catalog.find(p=>p.id===id);
              setData(d=>({...d,productId:id, itemName:p?(d.itemName||''):d.itemName}));
            }} placeholder="ex: 1280"/>
          </Field>
          <Field label="Désignation *">
            <Input value={data.itemName} onChange={e=>setData(d=>({...d,itemName:e.target.value}))} placeholder="ex: Adidas Spezial bleu marine taille 365"/>
          </Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <Field label="Prix de vente € *">
              <Input type="number" step="0.01" value={data.sellPrice} onChange={e=>setData(d=>({...d,sellPrice:e.target.value}))} placeholder="38.00"/>
            </Field>
            <Field label="Date vente">
              <Input type="date" value={data.saleDate} onChange={e=>setData(d=>({...d,saleDate:e.target.value}))}/>
            </Field>
          </div>
          
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,marginTop:4}}>
            <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:8,fontWeight:700}}>Acheteur</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <Field label="Nom complet"><Input value={data.buyerName} onChange={e=>setData(d=>({...d,buyerName:e.target.value}))} placeholder="Morel Anne-Sophie"/></Field>
              <Field label="Email"><Input type="email" value={data.buyerEmail} onChange={e=>setData(d=>({...d,buyerEmail:e.target.value}))} placeholder="annesomorel@yahoo.fr"/></Field>
              <Field label="Adresse complète"><Input value={data.buyerAddress} onChange={e=>setData(d=>({...d,buyerAddress:e.target.value}))} placeholder="6 rue Gutenberg, Montreuil, 93100, FR, France"/></Field>
            </div>
          </div>
          
          <Field label="N° transaction Vinted">
            <Input value={data.vintedNumber} onChange={e=>setData(d=>({...d,vintedNumber:e.target.value}))} placeholder="19921523337"/>
          </Field>
          
          {err&&<div style={{color:C.danger,fontSize:12}}>⚠ {err}</div>}
          
          <div style={{display:'flex',gap:8,marginTop:6}}>
            <Btn onClick={submit} color={C.accent} style={{flex:1}}>✓ Créer la facture</Btn>
            <Btn onClick={onClose} color={C.border}>Annuler</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// Réglages personnalisables
function InvoiceSettings({settings,setSettings,onClose}) {
  const [data,setData]=useState(settings);
  const save=()=>{setSettings(data);onClose();};
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:20,maxWidth:480,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <h3 style={{margin:0,color:C.accent}}>⚙ Réglages factures</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer',padding:0}}>×</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Field label="Nom de l'entreprise"><Input value={data.companyName} onChange={e=>setData(d=>({...d,companyName:e.target.value}))}/></Field>
          <Field label="Forme juridique"><Input value={data.companyType} onChange={e=>setData(d=>({...d,companyType:e.target.value}))}/></Field>
          <Field label="Adresse"><Input value={data.companyAddress} onChange={e=>setData(d=>({...d,companyAddress:e.target.value}))}/></Field>
          <Field label="SIRET"><Input value={data.siret} onChange={e=>setData(d=>({...d,siret:e.target.value}))}/></Field>
          <Field label="Message de bas de page"><Input value={data.footer} onChange={e=>setData(d=>({...d,footer:e.target.value}))}/></Field>
          <div style={{display:'flex',gap:8,marginTop:6}}>
            <Btn onClick={save} color={C.accent} style={{flex:1}}>✓ Enregistrer</Btn>
            <Btn onClick={onClose} color={C.border}>Annuler</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper pour les champs du formulaire
function Field({label,children}) {
  return <label style={{display:'flex',flexDirection:'column',gap:4}}>
    <span style={{fontSize:11,color:C.muted,fontWeight:600}}>{label}</span>
    {children}
  </label>;
}

// Helper format date FR
function fmtDate(d) {
  if(!d) return '—';
  try {
    const dt=new Date(d);
    if(isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'});
  } catch { return d; }
}

// Génération du PDF (HTML imprimable qui s'ouvre dans une nouvelle fenêtre)
function generatePDF(inv,settings) {
  let _logo=LOGO_CANCALE;
  try{ const _c=localStorage.getItem('vinted_custom_logo'); if(_c){ _logo=JSON.parse(_c); } }catch(_){}
  const html=`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Facture ${inv.number}</title>
<style>
body{font-family:Arial,sans-serif;color:#222;max-width:800px;margin:30px auto;padding:30px;background:#fff;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;}
.logo{width:140px;height:140px;background:#0a0a0a;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-weight:800;text-align:center;padding:10px;box-sizing:border-box;}
.logo .top{font-size:14px;letter-spacing:2px;border:1.5px solid #fff;border-radius:4px;padding:2px 8px;}
.logo .shoe{font-size:50px;margin:8px 0;}
.logo .bot{font-size:9px;letter-spacing:3px;}
.title{text-align:right;}
.title h1{margin:0;font-size:32px;letter-spacing:1px;}
.title .num{color:#666;font-size:14px;margin-top:6px;}
.parties{display:flex;justify-content:space-between;margin-bottom:30px;}
.party{flex:1;}
.party-label{font-weight:700;font-size:13px;color:#666;margin-bottom:4px;}
.party-info{font-size:13px;line-height:1.5;}
.party-info b{font-size:14px;}
table{width:100%;border-collapse:collapse;margin-bottom:20px;}
th{background:#f5f5f5;text-align:left;padding:10px;font-size:13px;border-bottom:2px solid #ddd;}
th.right{text-align:right;}
td{padding:10px;font-size:13px;border-bottom:1px solid #eee;}
td.right{text-align:right;}
.totals{margin-left:auto;width:50%;}
.totals .row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;}
.totals .row b{font-weight:700;}
.totals .total{border-top:1px solid #ccc;margin-top:6px;padding-top:8px;font-size:14px;}
.acquittee{color:#27a85d;text-align:right;margin-top:14px;font-size:14px;font-weight:700;}
.remarques{margin-top:40px;padding-top:20px;border-top:1px solid #eee;}
.remarques .label{font-weight:700;font-size:13px;color:#666;margin-bottom:6px;}
.remarques p{margin:4px 0;font-size:13px;}
.footer{margin-top:50px;text-align:center;color:#999;font-size:10px;}
@media print{body{margin:0;}}
</style></head><body>
<div class="header">
  <div class="logo">
    <img src="${_logo}" alt="Cancale Shoes Store" style="width:140px;height:auto;border-radius:8px;" />
  </div>
  <div class="title">
    <h1>FACTURE</h1>
    <div class="num"># ${inv.number}</div>
    <div class="num">Date : ${fmtDate(inv.saleDate)}</div>
  </div>
</div>
<div class="parties">
  <div class="party">
    <div class="party-label">De :</div>
    <div class="party-info"><b>${settings.companyName}</b><br>${settings.companyType}<br>${settings.companyAddress}<br>SIRET : ${settings.siret}</div>
  </div>
  <div class="party" style="text-align:right">
    <div class="party-label">À :</div>
    <div class="party-info"><b>${inv.buyerEmail||''}</b><br>${inv.buyerName||''}${inv.buyerAddress?', '+inv.buyerAddress:''}</div>
  </div>
</div>
<table>
  <thead><tr><th>Objet</th><th class="right">Quantité</th><th class="right">Prix unitaire (HT)</th><th class="right">Montant (HT)</th></tr></thead>
  <tbody><tr><td>${inv.itemName||''}</td><td class="right">1</td><td class="right">${(+inv.sellPrice).toFixed(2)} €</td><td class="right">${(+inv.sellPrice).toFixed(2)} €</td></tr></tbody>
</table>
<div class="totals">
  <div class="row"><b>Sous-total (TTC) :</b> <b>${(+inv.sellPrice).toFixed(2)} €</b></div>
  <div class="row total"><b>Total :</b> <b>${(+inv.sellPrice).toFixed(2)} €</b></div>
  <div class="row"><b>Montant payé :</b> <b>${(+inv.sellPrice).toFixed(2)} €</b></div>
</div>
<div class="acquittee">Facture acquittée</div>
<div class="remarques">
  <div class="label">Remarques :</div>
  ${inv.vintedNumber?`<p>Transaction Vinted n°${inv.vintedNumber}</p>`:''}
  <p>${settings.footer||'Merci pour votre achat !'}</p>
</div>
<div class="footer">N° d'étiquetage : ${inv.productId}</div>
<script>setTimeout(()=>{window.print();},400);</script>
</body></html>`;
  const w=window.open('','_blank');
  w.document.write(html);
  w.document.close();
}

/* ── Garage ──────────────────────────────────────────── */
function Garage({catalog,garageGrid,setGarageGrid,blockedCells,setBlockedCells,extraCols,setExtraCols,cellColors,setCellColors}) {
  const [searchInput,setSearchInput]=useState('');
  const [garageSearch,setGarageSearch]=useState(''); // recherche validée
  const [blockMode,setBlockMode]=useState(false);
  const [colorMode,setColorMode]=useState(false);
  const [addMode,setAddMode]=useState(false); // masquer les cases vides par défaut
  const [activeColor,setActiveColor]=useState('#ffb830');
  const [focusedCell,setFocusedCell]=useState(null); // {zid, ci, si}
  const highlightRef=React.useRef(null);

  // Quand une recherche trouve une case, on défile automatiquement jusqu'à elle (centré)
  useEffect(()=>{
    if(garageSearch.trim()&&highlightRef.current){
      setTimeout(()=>{
        try{ highlightRef.current.scrollIntoView({behavior:'smooth',block:'center',inline:'center'}); }catch(e){}
      },100);
    }
  },[garageSearch]);
  
  const isBlocked=(zid,ci,si)=>blockedCells[`${zid}_${ci}_${si}`]===true;
  const toggleBlock=(zid,ci,si)=>{
    const k=`${zid}_${ci}_${si}`;
    const u={...blockedCells};
    if(u[k]) delete u[k]; else u[k]=true;
    setBlockedCells(u); save('vinted_blocked',u);
  };
  
  const getColor=(zid,ci,si)=>cellColors[`${zid}_${ci}_${si}`];
  const setColor=(zid,ci,si,color)=>{
    const k=`${zid}_${ci}_${si}`;
    const u={...cellColors};
    if(color===null||u[k]===color) delete u[k]; else u[k]=color;
    setCellColors(u); save('vinted_colors',u);
  };
  
  const soldIds=useMemo(()=>new Set(catalog.filter(p=>p.status==='vendu').map(p=>p.id)),[catalog]);
  const BW=46,BH=26,SW=6,TH=5;
  const CW=BW+SW,CH=BH+TH,GAP=3;
  
  // LAYOUT effectif avec colonnes ajoutées par l'utilisateur
  const effectiveLayout=useMemo(()=>LAYOUT.map(z=>{
    const extra=extraCols[z.id]||0;
    return {...z, cols:[...z.cols, ...Array(extra).fill(25)]};
  }),[extraCols]);
  
  const globalMax=useMemo(()=>Math.max(...effectiveLayout.flatMap(z=>z.cols.map(b=>b+z.elev))),[effectiveLayout]);
  const TOTAL=useMemo(()=>effectiveLayout.reduce((s,z)=>s+z.cols.reduce((ss,b)=>ss+b,0),0),[effectiveLayout]);

  const allVals=useMemo(()=>
    Object.values(garageGrid).flatMap(a=>Array.isArray(a)?a:[]).filter(v=>v&&v.trim()!=='')
  ,[garageGrid]);
  
  // Set des valeurs en lowercase (recherche instantanée)
  const allValsSet=useMemo(()=>{
    const s=new Set();
    allVals.forEach(v=>s.add(v.trim().toLowerCase()));
    return s;
  },[allVals]);
  
  // Détection des doublons
  const duplicates=useMemo(()=>{
    const counts={};
    Object.entries(garageGrid).forEach(([key,arr])=>{
      if(!Array.isArray(arr)) return;
      arr.forEach((v,si)=>{
        const t=v&&v.trim();
        if(!t) return;
        if(!counts[t]) counts[t]=[];
        counts[t].push(`${key}_${si}`);
      });
    });
    return Object.entries(counts).filter(([k,v])=>v.length>1).map(([num,locs])=>({num,locs,count:locs.length}));
  },[garageGrid]);

  const getCol=(zid,ci,n)=>{
    const a=garageGrid[`${zid}_${ci}`];
    const r=Array.isArray(a)?[...a]:[];
    while(r.length<n) r.push('');
    return r.slice(0,n);
  };
  const setCol=(zid,ci,arr)=>{
    const u={...garageGrid,[`${zid}_${ci}`]:arr};
    setGarageGrid(u); save('vinted_garage_grid',u);
  };
  const onChange=(zid,ci,si,val,n)=>{const arr=getCol(zid,ci,n);arr[si]=val;setCol(zid,ci,arr);};
  
  // Compactage qui IGNORE les cases bloquées
  const onBlur=(zid,ci,n)=>{
    const arr=getCol(zid,ci,n);
    // Pour chaque position, savoir si elle est bloquée
    const blockedSet=new Set();
    for(let i=0;i<n;i++){
      if(isBlocked(zid,ci,i)) blockedSet.add(i);
    }
    // On extrait les valeurs non-bloquées avec leur statut
    const free=[]; // positions non-bloquées
    for(let i=0;i<n;i++){
      if(!blockedSet.has(i)) free.push({pos:i, val:arr[i]||''});
    }
    // Récupérer les valeurs remplies parmi free, en gardant l'ordre
    const filled=free.filter(f=>f.val.trim()!=='').map(f=>f.val);
    // Reconstruire : positions libres = vides en haut puis filled en bas
    const newArr=[...arr]; // garder les bloquées intactes
    let fillIdx=filled.length-1; // on remplit du bas vers le haut parmi les positions libres
    for(let i=free.length-1;i>=0;i--){
      const pos=free[i].pos;
      if(fillIdx>=0){
        newArr[pos]=filled[fillIdx];
        fillIdx--;
      } else {
        newArr[pos]='';
      }
    }
    setCol(zid,ci,newArr);
  };

  // Recherche : déclenchée seulement quand on appuie sur Entrée
  const triggerSearch=()=>setGarageSearch(searchInput);
  const clearSearch=()=>{setSearchInput('');setGarageSearch('');};
  const searchTrim=garageSearch.trim().toLowerCase();
  
  // Liste des cellules de chaque colonne pour navigation flèches
  const navigateFromCell=(zid,ci,si,direction)=>{
    // Trouve la zone et colonne courante dans effectiveLayout
    const zIdx=effectiveLayout.findIndex(z=>z.id===zid);
    if(zIdx<0) return;
    const z=effectiveLayout[zIdx];
    const maxBoxes=z.cols[ci];
    let newZ=zIdx, newCi=ci, newSi=si;
    if(direction==='up') newSi=Math.max(0,si-1);
    else if(direction==='down') newSi=Math.min(maxBoxes-1,si+1);
    else if(direction==='left') {
      if(ci>0){newCi=ci-1;}
      else if(zIdx>0){newZ=zIdx-1;newCi=effectiveLayout[zIdx-1].cols.length-1;}
      else return;
    }
    else if(direction==='right'){
      if(ci<z.cols.length-1){newCi=ci+1;}
      else if(zIdx<effectiveLayout.length-1){newZ=zIdx+1;newCi=0;}
      else return;
    }
    const targetZ=effectiveLayout[newZ];
    const targetMax=targetZ.cols[newCi];
    if(newSi>=targetMax) newSi=targetMax-1;
    setFocusedCell({zid:targetZ.id,ci:newCi,si:newSi});
    // Focus l'input après le rendu
    setTimeout(()=>{
      const inp=document.querySelector(`input[data-cell="${targetZ.id}_${newCi}_${newSi}"]`);
      if(inp) inp.focus();
    },10);
  };
  
  const COLORS=['#ffb830','#ff4d6d','#4da6ff','#a78bfa','#00e5a0','#ff8c42','#ec4899'];
  
  const addColumn=(zid)=>{
    const u={...extraCols, [zid]:(extraCols[zid]||0)+1};
    setExtraCols(u); save('vinted_extracols',u);
  };
  const removeColumn=(zid)=>{
    const u={...extraCols, [zid]:Math.max(0,(extraCols[zid]||0)-1)};
    setExtraCols(u); save('vinted_extracols',u);
  };

  let colN=0;
  return (
    <div style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
      <h2 style={{margin:0,color:C.accent,fontSize:20,fontWeight:800}}>Garage 🏠</h2>
      
      {/* Compteurs */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <Card style={{flex:'none',padding:'10px 16px'}}>
          <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:1,fontWeight:700}}>Paires</div>
          <div style={{fontSize:20,fontWeight:800,color:C.accent,marginTop:4}}>{allVals.length}</div>
        </Card>
        {duplicates.length>0&&<Card style={{flex:'none',padding:'10px 16px',background:`${C.danger}22`,borderColor:`${C.danger}66`}}>
          <div style={{fontSize:9,color:C.danger,textTransform:'uppercase',letterSpacing:1,fontWeight:700}}>⚠ Doublons</div>
          <div style={{fontSize:20,fontWeight:800,color:C.danger,marginTop:4}}>{duplicates.length}</div>
        </Card>}
      </div>
      
      {/* Liste des doublons */}
      {duplicates.length>0&&<Card style={{padding:12,background:`${C.danger}11`,borderColor:`${C.danger}44`}}>
        <div style={{fontSize:11,color:C.danger,fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>⚠ Numéros en doublon</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,fontSize:11}}>
          {duplicates.map(d=>(
            <span key={d.num} onClick={()=>{setSearchInput(d.num);setGarageSearch(d.num);}}
              style={{background:C.bg,padding:'4px 10px',borderRadius:6,cursor:'pointer',color:C.text,border:`1px solid ${C.danger}66`}}>
              <b style={{color:C.danger}}>#{d.num}</b> <span style={{color:C.muted}}>×{d.count}</span>
            </span>
          ))}
        </div>
      </Card>}
      
      {/* Recherche avec bouton + Entrée */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:200,display:'flex',gap:6}}>
          <Input value={searchInput}
            onChange={e=>setSearchInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')triggerSearch();}}
            placeholder="🔍 Numéro à chercher (puis Entrée)..."
          />
          <Btn small onClick={triggerSearch} color={C.accent}>Chercher</Btn>
          {garageSearch&&<Btn small onClick={clearSearch} color={C.border}>✕</Btn>}
        </div>
      </div>
      {searchTrim&&<div style={{fontSize:12,color:C.muted}}>
        {allValsSet.has(searchTrim)
          ?<span style={{color:C.warn}}>✓ Numéro #{garageSearch} trouvé — case en surbrillance</span>
          :<span style={{color:C.danger}}>✗ Numéro #{garageSearch} non trouvé dans le garage</span>}
      </div>}
      
      {/* Modes & boutons */}
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <Btn small onClick={()=>{setAddMode(!addMode);setBlockMode(false);setColorMode(false);}} color={addMode?C.accent:C.border} style={{color:addMode?'#fff':C.muted}}>
          {addMode?'✓ Mode ajout actif':'➕ Mode ajout'}
        </Btn>
        <Btn small onClick={()=>{setBlockMode(!blockMode);setColorMode(false);setAddMode(false);}} color={blockMode?C.danger:C.border} style={{color:blockMode?'#fff':C.muted}}>
          {blockMode?'✓ Mode blocage':'🔒 Mode blocage'}
        </Btn>
        <Btn small onClick={()=>{setColorMode(!colorMode);setBlockMode(false);setAddMode(false);}} color={colorMode?activeColor:C.border} style={{color:colorMode?'#fff':C.muted}}>
          {colorMode?'✓ Mode couleur':'🎨 Mode couleur'}
        </Btn>
        {colorMode&&<div style={{display:'flex',gap:4,alignItems:'center'}}>
          {COLORS.map(col=>(
            <button key={col} onClick={()=>setActiveColor(col)}
              style={{width:22,height:22,borderRadius:'50%',background:col,border:activeColor===col?'2px solid #fff':'2px solid transparent',cursor:'pointer'}}
              title={col}/>
          ))}
          <button onClick={()=>setActiveColor(null)}
            style={{width:22,height:22,borderRadius:'50%',background:'transparent',border:'2px dashed #555',cursor:'pointer',fontSize:10,color:'#666'}}
            title="Effacer">✕</button>
        </div>}
      </div>
      {(blockMode||colorMode||addMode)&&<div style={{fontSize:11,color:C.muted}}>
        {addMode&&'Toutes les cases sont visibles. Tu peux ajouter des paires dans les cases vides.'}
        {blockMode&&'Clique sur une case vide pour la bloquer/débloquer (zone non utilisable). '}
        {colorMode&&(activeColor?'Clique sur une case pour la colorier. Re-clique pour effacer la couleur.':'Sélectionne une couleur, ou ✕ pour effacer la couleur d\'une case.')}
      </div>}
      {/* Boutons d'ajout de colonnes */}
      <Card style={{padding:10}}>
        <div style={{fontSize:10,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:6,fontWeight:700}}>Colonnes</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {LAYOUT.map(z=>(
            <div key={z.id} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,background:C.bg,padding:'4px 8px',borderRadius:6}}>
              <span style={{color:C.muted}}>Colonnes :</span>
              <button onClick={()=>removeColumn(z.id)} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.danger,borderRadius:4,padding:'2px 8px',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>−</button>
              <span style={{color:C.accent,fontWeight:700,minWidth:24,textAlign:'center'}}>{z.cols.length+(extraCols[z.id]||0)}</span>
              <button onClick={()=>addColumn(z.id)} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.accent,borderRadius:4,padding:'2px 8px',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>+</button>
            </div>
          ))}
        </div>
      </Card>
      
      {/* Garage visuel */}
      <Card style={{overflowX:'auto',padding:'14px 10px'}}>
        <div style={{display:'flex',gap:GAP,marginBottom:6}}>
          {effectiveLayout.flatMap((z,zi)=>{
            const labels=z.cols.map((_,ci)=>(
              <div key={`l${zi}_${ci}`} style={{width:CW,flexShrink:0,fontSize:7,fontWeight:800,color:ci===0?C.accent:'transparent',textTransform:'uppercase',letterSpacing:0.5}}>
                {ci===0?z.name:''}
              </div>
            ));
            return labels;
          })}
        </div>
        <div style={{display:'flex',alignItems:'flex-end',gap:GAP}}>
          {effectiveLayout.flatMap((z,zi)=>{
            const cols=z.cols.map((maxBoxes,ci)=>{
              const spacerTop=globalMax-(maxBoxes+z.elev);
              const arr=getCol(z.id,ci,maxBoxes);
              const cn=++colN;
              return (
                <div key={`c${zi}_${ci}`} style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:GAP}}>
                  {Array.from({length:spacerTop},(_,i)=><div key={`sp${i}`} style={{width:CW,height:CH}}/>)}
                  {Array.from({length:z.elev},(_,i)=><div key={`ev${i}`} style={{width:CW,height:CH}}/>)}
                  {arr.map((val,si)=>{
                    const t=val?val.trim():'';
                    const isSold=t!==''&&soldIds.has(t);
                    const highlight=searchTrim!==''&&t.toLowerCase()===searchTrim;
                    const blocked=isBlocked(z.id,ci,si);
                    const cellColor=getColor(z.id,ci,si);
                    
                    // Masquer les cases vides (non bloquées, sans couleur) sauf en mode ajout/blocage/couleur
                    const showAllCells=addMode||blockMode||colorMode;
                    if(!showAllCells&&!blocked&&t===''&&!cellColor){
                      // Case invisible : on rend juste un placeholder vide pour garder l'alignement
                      return <div key={si} style={{width:CW,height:CH}}/>;
                    }
                    
                    if(blocked) return (
                      <div key={si} onClick={()=>{if(blockMode)toggleBlock(z.id,ci,si);}}
                        style={{position:'relative',width:CW,height:CH,
                          cursor:blockMode?'pointer':'default',
                          opacity:0.5}}>
                        <svg width={BW+SW} height={BH+TH} style={{display:'block',overflow:'visible'}}>
                          <rect x={0} y={TH} width={BW} height={BH} rx={2} fill='transparent' stroke='#444' strokeWidth='1' strokeDasharray='3,2'/>
                          <line x1={4} y1={TH+4} x2={BW-4} y2={TH+BH-4} stroke='#666' strokeWidth='1.5'/>
                          <line x1={BW-4} y1={TH+4} x2={4} y2={TH+BH-4} stroke='#666' strokeWidth='1.5'/>
                        </svg>
                      </div>
                    );
                    
                    return (
                      <div key={si} ref={highlight?highlightRef:null} onClick={()=>{
                        if(blockMode&&!t) toggleBlock(z.id,ci,si);
                        else if(colorMode) setColor(z.id,ci,si,activeColor);
                      }}
                        style={{position:'relative',width:CW,height:CH,
                          cursor:(blockMode&&!t)||colorMode?'pointer':'auto'}}>
                        {cellColor&&<div style={{position:'absolute',inset:0,top:TH,background:cellColor,opacity:0.35,borderRadius:2,zIndex:1,pointerEvents:'none'}}/>}
                        <Box val={val} isSold={isSold} highlight={highlight}/>
                        {!blockMode&&!colorMode&&<input value={val}
                          data-cell={`${z.id}_${ci}_${si}`}
                          onChange={e=>onChange(z.id,ci,si,e.target.value,maxBoxes)}
                          onBlur={()=>onBlur(z.id,ci,maxBoxes)}
                          onKeyDown={e=>{
                            if(e.key==='ArrowUp'){e.preventDefault();navigateFromCell(z.id,ci,si,'up');}
                            else if(e.key==='ArrowDown'){e.preventDefault();navigateFromCell(z.id,ci,si,'down');}
                            else if(e.key==='ArrowLeft'&&e.target.selectionStart===0){e.preventDefault();navigateFromCell(z.id,ci,si,'left');}
                            else if(e.key==='ArrowRight'&&e.target.selectionStart===e.target.value.length){e.preventDefault();navigateFromCell(z.id,ci,si,'right');}
                            else if(e.key==='Enter'){e.preventDefault();navigateFromCell(z.id,ci,si,'down');}
                          }}
                          style={{position:'absolute',left:0,top:TH,width:BW,height:BH,background:'transparent',border:'none',outline:'none',textAlign:'center',fontSize:8,fontWeight:800,color:'transparent',caretColor:C.warn,fontFamily:'inherit',cursor:'text',zIndex:3,boxSizing:'border-box'}}
                          onFocus={e=>{e.target.parentElement.style.filter='brightness(1.35)';}}
                          onBlurCapture={e=>{e.target.parentElement.style.filter='';}}
                        />}
                      </div>
                    );
                  })}
                  <div style={{fontSize:7,color:'#333',textAlign:'center',width:CW}}>{cn}</div>
                </div>
              );
            });
            return cols;
          })}
        </div>
      </Card>
    </div>
  );
}

/* ── App ─────────────────────────────────────────────── */

/* ── BackupModal ─────────────────────────────────────── */
function BackupModal({catalog,sales,garageGrid,blockedCells,extraCols,cellColors,onClose,onImport}) {
  const exportData=()=>{
    const data={
      catalog,sales,garageGrid,blockedCells,extraCols,cellColors,
      exportedAt:new Date().toISOString(),
      version:'1.0',
    };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`shop-cancale-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const importData=(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!data.catalog&&!data.sales){
          alert('❌ Fichier invalide : pas de données détectées');
          return;
        }
        if(window.confirm(`Importer cette sauvegarde ?\n\nCatalogue: ${data.catalog?.length||0} paires\nVentes: ${data.sales?.length||0} ventes\n\n⚠️ Tes données actuelles seront remplacées.`)){
          onImport(data);
        }
      }catch(err){
        alert('❌ Erreur de lecture : '+err.message);
      }
    };
    reader.readAsText(file);
  };
  
  return (
    <div onClick={onClose} style={{
      position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:100,
      display:'flex',alignItems:'center',justifyContent:'center',padding:20,
      animation:'fadeIn 0.2s',
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:C.card,border:`1px solid ${C.border}`,borderRadius:8,
        padding:24,maxWidth:480,width:'100%',
      }}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <h3 style={{margin:0,color:C.accent,fontSize:18,fontWeight:800}}>💾 Sauvegarde</h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:C.muted,fontSize:20,cursor:'pointer'}}>✕</button>
        </div>
        
        <div style={{fontSize:12,color:C.muted,marginBottom:18,lineHeight:1.5}}>
          Sauvegarde toutes tes données (catalogue, ventes, garage) dans un fichier JSON. Tu peux le restaurer plus tard ou sur un autre appareil.
        </div>
        
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{background:`${C.accent}11`,border:`1px solid ${C.accent}44`,borderRadius:8,padding:14}}>
            <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>📤 Exporter</div>
            <div style={{fontSize:12,color:C.text,marginBottom:10}}>
              <b>{catalog.length}</b> paires · <b>{sales.length}</b> ventes
            </div>
            <Btn small onClick={exportData} color={C.accent}>💾 Télécharger sauvegarde</Btn>
          </div>
          
          <div style={{background:`${C.warn}11`,border:`1px solid ${C.warn}44`,borderRadius:8,padding:14}}>
            <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>📥 Restaurer</div>
            <div style={{fontSize:12,color:C.text,marginBottom:10}}>
              ⚠️ Cela remplacera toutes tes données actuelles
            </div>
            <label style={{display:'inline-block',cursor:'pointer'}}>
              <input type="file" accept=".json" onChange={importData} style={{display:'none'}}/>
              <span style={{
                display:'inline-block',background:C.warn,color:'#000',
                border:'none',borderRadius:8,padding:'5px 12px',
                fontSize:12,fontWeight:700,fontFamily:'inherit',
              }}>📁 Choisir un fichier JSON</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stock Vinted ──────────────────────────────────────── */
// Suivi des annonces en ligne sur Vinted, avec réconciliation garage.
// - Saisie manuelle des numéros (à l'unité + collage en masse)
// - Une facture qui arrive => le numéro se retire automatiquement (géré dans App via useEffect)
// - Une facture supprimée => le numéro revient (géré dans App)
// - Nouveau numéro au catalogue (à partir de maintenant) => ajout auto (géré dans App)
// - Incohérences : compare le Stock Vinted avec les numéros présents dans le Garage
function StockVinted({stockVinted,setStockVinted,garageGrid,invoices,accounts,catalog}) {
  const [input,setInput]=useState('');
  const [bulk,setBulk]=useState('');
  const [showBulk,setShowBulk]=useState(false);
  const [search,setSearch]=useState('');
  const [accountFilter,setAccountFilter]=useState('all');

  const catAccountMap=useMemo(()=>{const m={};(catalog||[]).forEach(p=>{if(p.account)m[p.id]=p.account;});return m;},[catalog]);
  const accountColorMap=useMemo(()=>{const m={};(accounts||[]).forEach(a=>{m[a.id]=a.color;});return m;},[accounts]);

  // Normalise un numéro (string, trim)
  const norm=(v)=>String(v||'').trim();

  // Ajoute un numéro à l'unité
  const addOne=()=>{
    const n=norm(input);
    if(!n){ return; }
    if(stockVinted.includes(n)){ alert('Le numéro '+n+' est déjà dans le stock Vinted.'); setInput(''); return; }
    const u=[...stockVinted,n];
    setStockVinted(u); save('vinted_stock_vinted',u);
    setInput('');
  };

  // Ajoute plusieurs numéros d'un coup (séparés par virgule, espace, point-virgule ou saut de ligne)
  const addBulk=()=>{
    const parts=bulk.split(/[\s,;]+/).map(norm).filter(Boolean);
    if(parts.length===0){ alert('Aucun numéro détecté.'); return; }
    const set=new Set(stockVinted);
    let added=0;
    parts.forEach(p=>{ if(!set.has(p)){ set.add(p); added++; } });
    const u=Array.from(set);
    setStockVinted(u); save('vinted_stock_vinted',u);
    setBulk(''); setShowBulk(false);
    alert(added+' numéro(s) ajouté(s) au stock Vinted.');
  };

  // Retire un numéro manuellement
  const removeOne=(n)=>{
    const u=stockVinted.filter(x=>x!==n);
    setStockVinted(u); save('vinted_stock_vinted',u);
  };

  // Numéros présents dans le garage (toutes les cases non vides)
  const garageNums=useMemo(()=>{
    const s=new Set();
    Object.values(garageGrid||{}).forEach(arr=>{
      if(Array.isArray(arr)) arr.forEach(v=>{ const t=norm(v); if(t) s.add(t); });
    });
    return s;
  },[garageGrid]);

  // Set du stock Vinted pour comparaisons rapides
  const stockSet=useMemo(()=>new Set(stockVinted.map(norm)),[stockVinted]);

  // Incohérences :
  //  - "en ligne mais pas au garage" : numéro dans Stock Vinted mais introuvable dans le garage
  //    (=> l'annonce est en ligne alors que la paire n'est plus là : à vérifier)
  //  - "au garage mais pas en ligne" : numéro présent au garage mais pas dans Stock Vinted
  //    (=> paire stockée mais pas annoncée : peut-être à mettre en ligne)
  const enLignePasGarage=useMemo(()=>
    stockVinted.map(norm).filter(n=>n&&!garageNums.has(n)).sort((a,b)=>(+a||0)-(+b||0))
  ,[stockVinted,garageNums]);

  const garagePasEnLigne=useMemo(()=>
    Array.from(garageNums).filter(n=>!stockSet.has(n)).sort((a,b)=>(+a||0)-(+b||0))
  ,[garageNums,stockSet]);

  // Liste filtrée pour l'affichage
  const liste=useMemo(()=>{
    const arr=[...stockVinted].map(norm).sort((a,b)=>(+a||0)-(+b||0));
    const q=norm(search).toLowerCase();
    return arr.filter(n=>{
      if(q&&!n.toLowerCase().includes(q)) return false;
      if(accountFilter!=='all'&&catAccountMap[n]!==accountFilter) return false;
      return true;
    });
  },[stockVinted,search,accountFilter,catAccountMap]);

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
        <h2 style={{margin:0,fontSize:16,fontWeight:800}}>🟢 Stock Vinted ({stockVinted.length})</h2>
        <button onClick={()=>setShowBulk(s=>!s)} style={{background:C.purple,color:'#fff',border:'none',borderRadius:8,padding:'7px 12px',fontWeight:700,fontSize:12,cursor:'pointer'}}>
          {showBulk?'Fermer':'Coller en masse'}
        </button>
      </div>

      <p style={{fontSize:12.5,color:C.muted,margin:'0 0 10px',lineHeight:1.5}}>
        Liste de tes annonces actuellement en ligne sur Vinted. Ajoute tes numéros un par un ci-dessous.
        Quand une facture arrive, le numéro se retire tout seul ; si tu supprimes la facture, il revient. Les nouveaux numéros ajoutés au catalogue s'ajoutent aussi automatiquement.
      </p>

      {/* Filtre par compte */}
      {accounts&&accounts.length>0&&(
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
          <Btn small onClick={()=>setAccountFilter('all')} color={accountFilter==='all'?C.accent:C.border} style={{color:accountFilter==='all'?'#fff':C.muted}}>Tous</Btn>
          {accounts.map(acc=>(
            <Btn key={acc.id} small onClick={()=>setAccountFilter(acc.id)} color={accountFilter===acc.id?acc.color:C.border} style={{color:accountFilter===acc.id?'#fff':C.muted}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:acc.color,display:'inline-block'}}/>
                {acc.name}
              </span>
            </Btn>
          ))}
        </div>
      )}

      {/* Saisie à l'unité */}
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter') addOne(); }}
          placeholder="N° de l'annonce (ex : 1908)"
          inputMode="numeric"
          style={{flex:1,padding:'10px 12px',border:`1px solid ${C.border||'#ccc'}`,borderRadius:8,fontSize:14}}
        />
        <button onClick={addOne} style={{background:C.accent,color:C.onAccent,border:'none',borderRadius:8,padding:'10px 16px',fontWeight:700,fontSize:14,cursor:'pointer'}}>
          Ajouter
        </button>
      </div>

      {/* Collage en masse (optionnel) */}
      {showBulk&&(
        <div style={{marginBottom:14,padding:12,background:C.card2||'rgba(0,0,0,0.04)',borderRadius:8}}>
          <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Colle plusieurs numéros (séparés par espace, virgule ou retour à la ligne) :</div>
          <textarea
            value={bulk}
            onChange={e=>setBulk(e.target.value)}
            rows={4}
            placeholder="1908 1925 898 ..."
            style={{width:'100%',padding:10,border:`1px solid ${C.border||'#ccc'}`,borderRadius:8,fontSize:13,boxSizing:'border-box',resize:'vertical'}}
          />
          <button onClick={addBulk} style={{marginTop:8,background:C.accent,color:C.onAccent,border:'none',borderRadius:8,padding:'9px 16px',fontWeight:700,fontSize:13,cursor:'pointer'}}>
            Ajouter tout
          </button>
        </div>
      )}

      {/* Incohérences */}
      {(enLignePasGarage.length>0||garagePasEnLigne.length>0)&&(
        <div style={{marginBottom:16}}>
          <h3 style={{fontSize:14,fontWeight:800,margin:'0 0 8px',color:C.warn}}>⚠️ Incohérences avec le garage</h3>

          {enLignePasGarage.length>0&&(
            <div style={{marginBottom:10,padding:10,background:'rgba(156,106,31,0.10)',borderRadius:8}}>
              <div style={{fontSize:12.5,fontWeight:700,marginBottom:4}}>En ligne mais absent du garage ({enLignePasGarage.length})</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Ces annonces sont dans ton stock Vinted mais leur numéro n'est pas dans le garage.</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {enLignePasGarage.map(n=>(
                  <span key={n} style={{background:C.warn,color:'#fff',borderRadius:6,padding:'3px 8px',fontSize:12,fontWeight:700}}>{n}</span>
                ))}
              </div>
            </div>
          )}

          {garagePasEnLigne.length>0&&(
            <div style={{padding:10,background:'rgba(0,119,130,0.08)',borderRadius:8}}>
              <div style={{fontSize:12.5,fontWeight:700,marginBottom:4}}>Au garage mais pas en ligne ({garagePasEnLigne.length})</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Ces paires sont dans le garage mais pas dans ton stock Vinted (peut-être à mettre en ligne).</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {garagePasEnLigne.map(n=>(
                  <span key={n} style={{background:C.accent,color:C.onAccent,borderRadius:6,padding:'3px 8px',fontSize:12,fontWeight:700}}>{n}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recherche */}
      {stockVinted.length>0&&(
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Rechercher un numéro…"
          style={{width:'100%',padding:'9px 12px',border:`1px solid ${C.border||'#ccc'}`,borderRadius:8,fontSize:13,boxSizing:'border-box',marginBottom:12}}
        />
      )}

      {/* Liste des numéros en ligne */}
      {liste.length===0?(
        <div style={{textAlign:'center',color:C.muted,fontSize:13,padding:'30px 0'}}>
          {stockVinted.length===0?'Aucun numéro pour le moment. Ajoute tes annonces en ligne ci-dessus.':'Aucun résultat.'}
        </div>
      ):(
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {liste.map(n=>{
            const absentGarage=!garageNums.has(n);
            const accId=catAccountMap[n];
            const accColor=accId&&accountColorMap[accId];
            return (
              <span key={n} style={{
                display:'inline-flex',alignItems:'center',gap:6,
                background:absentGarage?'rgba(156,106,31,0.12)':(C.card2||'rgba(0,0,0,0.05)'),
                border:absentGarage?`1px solid ${C.warn}`:'1px solid transparent',
                borderRadius:8,padding:'5px 8px 5px 10px',fontSize:13,fontWeight:700
              }}>
                {accColor&&<span style={{width:8,height:8,borderRadius:'50%',background:accColor,display:'inline-block',flexShrink:0}}/>}
                {n}
                <button onClick={()=>removeOne(n)} title="Retirer" style={{background:'none',border:'none',color:C.danger,cursor:'pointer',fontSize:15,lineHeight:1,padding:0,fontWeight:900}}>×</button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}


function jpegToPdfFillA4(jpegBytes,imgW,imgH,pageW,pageH){
  const scale=Math.min(pageW/imgW,pageH/imgH);
  const dW=Math.round(imgW*scale),dH=Math.round(imgH*scale);
  const ox=Math.round((pageW-dW)/2),oy=Math.round((pageH-dH)/2);
  const enc=new TextEncoder();
  const parts=[],off={};
  const push=s=>parts.push(typeof s==='string'?enc.encode(s):s);
  const len=()=>parts.reduce((a,p)=>a+p.length,0);
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  off[1]=len();push(`1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n`);
  off[2]=len();push(`2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n`);
  off[3]=len();push(`3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pageW} ${pageH}]/Contents 4 0 R/Resources<</XObject<</I 5 0 R>>>>>>\nendobj\n`);
  const s4=`q ${dW} 0 0 ${dH} ${ox} ${oy} cm /I Do Q`;
  off[4]=len();push(`4 0 obj\n<</Length ${s4.length}>>\nstream\n${s4}\nendstream\nendobj\n`);
  off[5]=len();push(`5 0 obj\n<</Type/XObject/Subtype/Image/Width ${imgW}/Height ${imgH}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpegBytes.length}>>\nstream\n`);
  push(jpegBytes);
  push('\nendstream\nendobj\n');
  const xp=len();
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for(let i=1;i<=5;i++)push(`${String(off[i]).padStart(10,'0')} 00000 n \n`);
  push(`trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xp}\n%%EOF`);
  const buf=new Uint8Array(parts.reduce((a,p)=>a+p.length,0));
  let o=0;for(const p of parts){buf.set(p,o);o+=p.length;}
  return new Blob([buf],{type:'application/pdf'});
}

// PDF multi-pages : pages = [{jpegBytes, imgW, imgH}]
function jpegsToPdfA4(pages,pageW=595,pageH=842){
  const enc=new TextEncoder();
  const parts=[],off={};
  const push=s=>parts.push(typeof s==='string'?enc.encode(s):s);
  const len=()=>parts.reduce((a,p)=>a+p.length,0);
  const n=pages.length;
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  off[1]=len();push(`1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n`);
  const kids=Array.from({length:n},(_,i)=>`${3+i*3} 0 R`).join(' ');
  off[2]=len();push(`2 0 obj\n<</Type/Pages/Kids[${kids}]/Count ${n}>>\nendobj\n`);
  for(let i=0;i<n;i++){
    const {jpegBytes,imgW,imgH,pageW:pw=pageW,pageH:ph=pageH}=pages[i];
    const scale=Math.min(pw/imgW,ph/imgH);
    const dW=Math.round(imgW*scale),dH=Math.round(imgH*scale);
    const ox=Math.round((pw-dW)/2),oy=Math.round((ph-dH)/2);
    const pg=3+i*3,ct=4+i*3,im=5+i*3,nm=`I${i+1}`;
    off[pg]=len();push(`${pg} 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pw} ${ph}]/Contents ${ct} 0 R/Resources<</XObject<</${nm} ${im} 0 R>>>>>>\nendobj\n`);
    const s=`q ${dW} 0 0 ${dH} ${ox} ${oy} cm /${nm} Do Q`;
    off[ct]=len();push(`${ct} 0 obj\n<</Length ${s.length}>>\nstream\n${s}\nendstream\nendobj\n`);
    off[im]=len();push(`${im} 0 obj\n<</Type/XObject/Subtype/Image/Width ${imgW}/Height ${imgH}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpegBytes.length}>>\nstream\n`);
    push(jpegBytes);push('\nendstream\nendobj\n');
  }
  const tot=2+n*3,xp=len();
  push(`xref\n0 ${tot+1}\n0000000000 65535 f \n`);
  for(let i=1;i<=tot;i++)push(`${String(off[i]).padStart(10,'0')} 00000 n \n`);
  push(`trailer\n<</Size ${tot+1}/Root 1 0 R>>\nstartxref\n${xp}\n%%EOF`);
  const buf=new Uint8Array(parts.reduce((a,p)=>a+p.length,0));
  let o=0;for(const p of parts){buf.set(p,o);o+=p.length;}
  return new Blob([buf],{type:'application/pdf'});
}

const PAYS_FLAGS={France:'🇫🇷',Italie:'🇮🇹',Espagne:'🇪🇸',Allemagne:'🇩🇪',Belgique:'🇧🇪','Pays-Bas':'🇳🇱',Suisse:'🇨🇭',Luxembourg:'🇱🇺',Autriche:'🇦🇹',Portugal:'🇵🇹',Pologne:'🇵🇱',Suède:'🇸🇪',Danemark:'🇩🇰',Finlande:'🇫🇮',Norvège:'🇳🇴',Tchéquie:'🇨🇿',Hongrie:'🇭🇺',Roumanie:'🇷🇴',Grèce:'🇬🇷','Royaume-Uni':'🇬🇧'};
const paysFlag=p=>{if(!p)return null;for(const[k,v]of Object.entries(PAYS_FLAGS))if(p.toLowerCase().includes(k.toLowerCase()))return v+' '+p;return'🌍 '+p;};

function BordereauxView({bordereaux,setBordereaux,appsScriptUrl,photos,catalog,sales,setSales}) {
  const [filter,setFilter]=React.useState('à imprimer');
  const [selected,setSelected]=React.useState(new Set());
  const [batchLoading,setBatchLoading]=React.useState(false);

  const FIREBASE_BASE=FIREBASE_URL.replace('.json','');
  const [loadingPdf,setLoadingPdf]=React.useState(null);

  const [pdfViewer,setPdfViewer]=React.useState(null); // {url, blob, isPdf, numero, modele, taille}
  const [rotated,setRotated]=React.useState(false);
  const embedContainerRef=React.useRef(null);
  const [cSize,setCSize]=React.useState(null);

  React.useEffect(()=>{
    if(!window.pdfjsLib){
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';};
      document.head.appendChild(s);
    }
  },[]);

  const handlePrint=async(b)=>{
    if(!b||!b.id) return;
    setLoadingPdf(b.id);
    try {
      const res=await fetch(`${FIREBASE_BASE}/vinted_bordereau_pdfs/${b.id}.json`);
      const base64=await res.json();
      if(base64&&typeof base64==='string'){
        const bin=atob(base64);
        const arr=new Uint8Array(bin.length);
        for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
        const pdfBlob=new Blob([arr],{type:'application/pdf'});
        // Charger PDF.js une seule fois
        if(!window.pdfjsLib){
          await new Promise((res,rej)=>{
            const s=document.createElement('script');
            s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            s.onload=res;s.onerror=rej;document.head.appendChild(s);
          });
          window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        const pdf=await window.pdfjsLib.getDocument({data:arr}).promise;
        const page=await pdf.getPage(1);
        const [,,rawW,rawH]=page.view;
        const isPortrait=rawH>rawW;
        const vp=page.getViewport({scale:2});
        const c=document.createElement('canvas');
        c.width=Math.round(vp.width);c.height=Math.round(vp.height);
        await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
        let printBlob=null;
        {
          // PDF.js applique /Rotate → canvas toujours dans le bon sens de lecture
          const infoText=[b.numero&&`N°${b.numero}`,b.modele,b.taille&&`T.${b.taille}`].filter(Boolean).join('  ');
          if(infoText){
            const ctx=c.getContext('2d');
            const fs=Math.round(Math.min(c.width,c.height)*0.016);
            ctx.font=`bold ${fs}px sans-serif`;
            ctx.fillStyle='#111';
            // Mondial Relay (portrait) : texte en HAUT — hors de la zone du bordereau collé
            // Chronopost (paysage rendu portrait) : texte en bas
            const textY=isPortrait ? fs*1.4 : c.height-fs*0.4;
            ctx.fillText(infoText,10,textY);
          }
          const pj=await new Promise(r=>c.toBlob(r,'image/jpeg',0.92));
          const pb=new Uint8Array(await pj.arrayBuffer());
          // Choisit portrait ou paysage A4 selon l'orientation du canvas rendu
          const pw=c.width>c.height?842:595,ph=c.width>c.height?595:842;
          printBlob=jpegToPdfFillA4(pb,c.width,c.height,pw,ph);
        }
        // preview JPEG
        const jpegBlob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.92));
        const previewSrc=URL.createObjectURL(jpegBlob);
        setPdfViewer({previewSrc,pdfBlob,printBlob,isPdf:true,id:b.id,numero:b.numero,modele:b.modele,taille:b.taille});
        setLoadingPdf(null);
        return;
      }
    } catch(_){}
    setPdfViewer({previewSrc:null,printBlob:null,pdfBlob:null,isPdf:false,id:b.id,numero:b.numero,modele:b.modele,taille:b.taille});
    setLoadingPdf(null);
  };

  const doPrint=async()=>{
    if(!pdfViewer) return;
    const blob=pdfViewer.printBlob||pdfViewer.pdfBlob;
    if(!blob) return;
    const file=new File([blob],'bordereau.pdf',{type:'application/pdf'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      try{
        await navigator.share({files:[file],title:`Bordereau N°${pdfViewer.numero||''}`});
        if(pdfViewer.id) markImprime(pdfViewer.id);
      }catch(_){}
    }else if(pdfViewer.previewSrc){
      window.open(pdfViewer.previewSrc,'_blank');
    }
  };

  // Impression groupée : assemble un PDF multi-pages et l'envoie une seule fois à AirPrint
  const handlePrintAll=async(items)=>{
    if(!items||!items.length) return;
    setBatchLoading(true);
    try{
      if(!window.pdfjsLib){
        await new Promise((res,rej)=>{
          const s=document.createElement('script');
          s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          s.onload=res;s.onerror=rej;document.head.appendChild(s);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      const pages=[];
      for(const b of items){
        try{
          const res=await fetch(`${FIREBASE_BASE}/vinted_bordereau_pdfs/${b.id}.json`);
          const base64=await res.json();
          if(!base64||typeof base64!=='string') continue;
          const bin=atob(base64);
          const arr=new Uint8Array(bin.length);
          for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
          const pdf=await window.pdfjsLib.getDocument({data:arr}).promise;
          const page=await pdf.getPage(1);
          const [,,rawW,rawH]=page.view;
          const isPortrait=rawH>rawW;
          const vp=page.getViewport({scale:2});
          const c=document.createElement('canvas');
          c.width=Math.round(vp.width);c.height=Math.round(vp.height);
          await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
          const infoText=[b.numero&&`N°${b.numero}`,b.modele,b.taille&&`T.${b.taille}`].filter(Boolean).join('  ');
          if(infoText){
            const ctx=c.getContext('2d');
            const fs=Math.round(Math.min(c.width,c.height)*0.016);
            ctx.font=`bold ${fs}px sans-serif`;ctx.fillStyle='#111';
            ctx.fillText(infoText,10,isPortrait?fs*1.4:c.height-fs*0.4);
          }
          const pj=await new Promise(r=>c.toBlob(r,'image/jpeg',0.92));
          const pw=c.width>c.height?842:595,ph=c.width>c.height?595:842;
          pages.push({jpegBytes:new Uint8Array(await pj.arrayBuffer()),imgW:c.width,imgH:c.height,pageW:pw,pageH:ph});
        }catch(_){}
      }
      if(!pages.length){setBatchLoading(false);return;}
      const combined=jpegsToPdfA4(pages);
      const file=new File([combined],`bordereaux-${pages.length}.pdf`,{type:'application/pdf'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        try{
          await navigator.share({files:[file],title:`${pages.length} bordereaux`});
          // Déplace tous les bordereaux imprimés en corbeille
          const ids=new Set(items.map(b=>b.id));
          const u=(Array.isArray(bordereaux)?bordereaux:[]).map(b=>ids.has(b.id)?{...b,statut:'imprimé'}:b);
          setBordereaux(u);save('vinted_bordereaux',u);
          clearSel();
        }catch(_){}
      }else{
        const url=URL.createObjectURL(combined);
        window.open(url,'_blank');
      }
    }catch(_){}
    setBatchLoading(false);
  };

  const all=Array.isArray(bordereaux)?bordereaux:[];
  const filtered=all
    .filter(b=>(b.statut||'à imprimer')===filter)
    .slice().sort((a,b)=>{
      const da=a.dateVente||a.date||'';
      const db=b.dateVente||b.date||'';
      const toISO=s=>s?s.split('/').reverse().join('-'):s;
      return toISO(db).localeCompare(toISO(da));
    });

  const toggleSelect=(id)=>{const s=new Set(selected);s.has(id)?s.delete(id):s.add(id);setSelected(s);};
  const selectAll=()=>setSelected(new Set(filtered.map(b=>b.id)));
  const clearSel=()=>setSelected(new Set());
  const selectedItems=filtered.filter(b=>selected.has(b.id));

  const restaurer=(id)=>{
    const u=all.map(b=>b.id===id?{...b,statut:'à imprimer'}:b);
    setBordereaux(u); save('vinted_bordereaux',u);
  };

  const markImprime=(id)=>{
    const u=all.map(b=>b.id===id?{...b,statut:'imprimé'}:b);
    setBordereaux(u); save('vinted_bordereaux',u);
  };

  const deleteSelected=()=>{
    if(!window.confirm(`Supprimer ${selected.size} bordereau(x) définitivement ?`)) return;
    const u=all.filter(b=>!selected.has(b.id));
    setBordereaux(u); save('vinted_bordereaux',u);
    clearSel();
  };

  const viderCorbeille=()=>{
    const n=all.filter(b=>b.statut==='imprimé').length;
    if(!n) return;
    if(!window.confirm(`Vider la corbeille (${n} bordereau${n>1?'x':''}) définitivement ?`)) return;
    const u=all.filter(b=>b.statut!=='imprimé');
    setBordereaux(u); save('vinted_bordereaux',u);
    clearSel();
  };

  const [syncingGmail,setSyncingGmail]=React.useState(false);
  const [syncMsg,setSyncMsg]=React.useState(null);

  const syncGmailSales=async()=>{
    setSyncingGmail(true);
    setSyncMsg(null);
    try{
      if(appsScriptUrl){
        try{ await fetch(appsScriptUrl,{mode:'no-cors'}); }catch(_){}
        await new Promise(r=>setTimeout(r,2000));
      }

      // --- Nouvelles ventes : crée bordereaux + entrée Ventes "en attente" ---
      const res=await fetch(`${FIREBASE_BASE}/vinted_incoming_sales.json`);
      const incoming=await res.json();
      const existingNums=new Set(all.map(b=>String(b.numero||'')).filter(Boolean));
      const currentSales=Array.isArray(sales)?[...sales]:[];
      const existingSaleNums=new Set(currentSales.map(s=>String(s.numero||'')).filter(Boolean));

      let addedCount=0;
      if(incoming&&Array.isArray(incoming)&&incoming.length>0){
        const toAdd=incoming.filter(v=>!existingNums.has(String(v.numero||'')));
        if(toAdd.length>0){
          // Bordereaux
          const newBordereaux=toAdd.map(v=>({
            id: v.id||('gmail_'+Math.random().toString(36).slice(2,10)),
            emailId: v.emailId||null,
            numero: v.numero,
            modele: v.modele||'',
            sellPrice: v.sellPrice??null,
            date: v.date||new Date().toLocaleDateString('fr-FR'),
            compte: v.compte||'',
            statut: 'à imprimer',
            paiement: 'en attente',
            source: 'email',
          }));
          const updatedB=[...newBordereaux,...all];
          setBordereaux(updatedB);
          save('vinted_bordereaux',updatedB);

          // Entrées Ventes "en attente" (sans prix pour l'instant)
          const pendingSales=toAdd
            .filter(v=>!existingSaleNums.has(String(v.numero||'')))
            .map(v=>({
              id: 'sale_'+Math.random().toString(36).slice(2,10),
              numero: v.numero,
              productId: v.modele||'',
              buyPrice: null,
              sellPrice: null,
              profit: null,
              multi: null,
              saleDate: v.date||'',
              receiveDate: '',
              compte: v.compte||'',
              statut: 'en attente',
              source: 'email',
              createdAt: new Date().toISOString(),
            }));
          if(pendingSales.length>0){
            const updatedS=[...pendingSales,...currentSales];
            setSales(updatedS);
            save('vinted_sales',updatedS);
            pendingSales.forEach(s=>existingSaleNums.add(String(s.numero)));
          }
          addedCount=toAdd.length;
        }
        await fetch(`${FIREBASE_BASE}/vinted_incoming_sales.json`,{method:'DELETE'});
      }

      // --- Paiements reçus : finalise la vente en attente ---
      const resP=await fetch(`${FIREBASE_BASE}/vinted_incoming_payments.json`);
      const payments=await resP.json();
      if(payments&&Array.isArray(payments)&&payments.length>0){
        const cat=Array.isArray(catalog)?catalog:[];
        const currentBordereaux=Array.isArray(bordereaux)?bordereaux:[];
        // Relit les ventes depuis l'état le plus à jour
        const latestSales=Array.isArray(sales)?[...sales]:[];
        let payUpdated=false;

        payments.forEach(p=>{
          if(!p.numero||!p.receiveDate) return;
          const idx=latestSales.findIndex(s=>String(s.numero)===String(p.numero));
          const bord=currentBordereaux.find(b=>String(b.numero)===String(p.numero));
          const catItem=cat.find(c=>String(c.id)===String(p.numero));
          const buyPrice=catItem?.buyPrice??null;
          const sellPrice=p.amount??bord?.sellPrice??null;
          const profit=(sellPrice!=null&&buyPrice!=null)?Math.round((sellPrice-buyPrice)*100)/100:null;

          if(idx>=0){
            // Met à jour l'entrée en attente existante
            latestSales[idx]={
              ...latestSales[idx],
              buyPrice, sellPrice, profit,
              multi:(sellPrice&&buyPrice&&buyPrice>0)?Math.round(sellPrice/buyPrice*100)/100:null,
              receiveDate: p.receiveDate,
              statut: 'finalisée',
            };
          } else {
            // Crée directement la vente finalisée si pas de "en attente"
            latestSales.unshift({
              id: 'sale_'+Math.random().toString(36).slice(2,10),
              numero: p.numero,
              productId: bord?.modele||'',
              buyPrice, sellPrice, profit,
              multi:(sellPrice&&buyPrice&&buyPrice>0)?Math.round(sellPrice/buyPrice*100)/100:null,
              saleDate: bord?.date||'',
              receiveDate: p.receiveDate,
              compte: bord?.compte||'',
              statut: 'finalisée',
              source: 'email',
              createdAt: new Date().toISOString(),
            });
          }
          payUpdated=true;
        });

        if(payUpdated){ setSales(latestSales); save('vinted_sales',latestSales); }
        await fetch(`${FIREBASE_BASE}/vinted_incoming_payments.json`,{method:'DELETE'});
      }

      setSyncMsg(addedCount>0
        ?`${addedCount} vente${addedCount>1?'s':''} importée${addedCount>1?'s':''} !`
        :'Aucune nouvelle vente.');
    }catch(e){
      setSyncMsg('Erreur sync : '+e.message);
    }
    setSyncingGmail(false);
  };

  const counts={
    'à imprimer': all.filter(b=>(b.statut||'à imprimer')==='à imprimer').length,
    'imprimé':    all.filter(b=>b.statut==='imprimé').length,
  };

  const pdfViewerEl=pdfViewer&&(
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9999,background:'#111',display:'flex',flexDirection:'column'}}>
      <div style={{flex:1,background:'#fff',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {pdfViewer.previewSrc
          ? <img src={pdfViewer.previewSrc} style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',display:'block'}}/>
          : <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100%',gap:10,padding:24}}>
              <div style={{fontSize:42,fontWeight:900}}>N°{pdfViewer.numero||'?'}</div>
              {pdfViewer.modele&&<div style={{fontSize:15,fontWeight:700}}>{pdfViewer.modele}</div>}
              {pdfViewer.taille&&<div style={{background:'#000',color:'#fff',padding:'4px 16px',borderRadius:5,fontSize:22,fontWeight:900}}>T.{pdfViewer.taille}</div>}
              <div style={{fontSize:12,color:'#999',marginTop:4}}>PDF non disponible</div>
            </div>
        }
      </div>
      <div style={{display:'flex',gap:8,padding:'12px 16px',background:'#1c1c1e',flexShrink:0,paddingBottom:'max(12px,env(safe-area-inset-bottom))'}}>
        {pdfViewer.pdfBlob&&<button onClick={doPrint} style={{flex:1,padding:'14px 0',borderRadius:12,background:'#007AFF',color:'#fff',border:'none',fontSize:17,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>🖨️ Imprimer</button>}
        <button onClick={()=>{if(pdfViewer.previewSrc)URL.revokeObjectURL(pdfViewer.previewSrc);setRotated(false);setCSize(null);setPdfViewer(null);}} style={{flex:1,padding:'14px 0',borderRadius:12,background:'transparent',color:'#fff',border:'1px solid #555',fontSize:17,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>✕ Fermer</button>
      </div>
    </div>
  );

  // Overlay d'assemblage en cours
  if(batchLoading){
    return (
      <div style={{padding:'0 4px'}}>
        <div style={{background:C.surface,borderRadius:16,padding:32,textAlign:'center',marginTop:20}}>
          <div style={{fontSize:13,color:C.muted,marginBottom:8}}>⏳ Assemblage des bordereaux...</div>
          <div style={{fontSize:11,color:C.muted}}>Le PDF multi-pages se prépare, patiente quelques secondes.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{padding:'0 4px'}}>
      {pdfViewerEl}
      {/* Sync Gmail */}
      <div style={{display:'flex',gap:8,marginBottom:10,alignItems:'center'}}>
        <button onClick={syncGmailSales} disabled={syncingGmail} style={{
          padding:'7px 14px',borderRadius:20,fontSize:12,fontWeight:700,cursor:syncingGmail?'default':'pointer',
          background:C.accent,color:'#fff',border:'none',fontFamily:'inherit',
          opacity:syncingGmail?0.6:1,flexShrink:0,
        }}>{syncingGmail?'⏳ Sync...':'📧 Sync Gmail'}</button>
        {syncMsg&&<span style={{fontSize:11,color:C.muted,fontWeight:600}}>{syncMsg}</span>}
      </div>

      {/* Filtres */}
      <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
        {(['à imprimer','imprimé']).map(k=>(
          <button key={k} onClick={()=>{setFilter(k);clearSel();}} style={{
            padding:'5px 14px',borderRadius:20,fontSize:12,fontWeight:700,cursor:'pointer',
            background:filter===k?C.accent:'transparent',
            color:filter===k?'#fff':C.muted,
            border:`1.5px solid ${filter===k?C.accent:C.border}`,fontFamily:'inherit',
          }}>{k==='à imprimer'?'À imprimer':'🗑️ Corbeille'} ({counts[k]})</button>
        ))}
        {filter==='imprimé'&&counts['imprimé']>0&&(
          <button onClick={viderCorbeille} style={{
            marginLeft:'auto',padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:700,cursor:'pointer',
            background:'transparent',color:C.danger,border:`1.5px solid ${C.danger}`,fontFamily:'inherit',
          }}>Vider la corbeille</button>
        )}
      </div>

      {/* Barre de sélection */}
      {filtered.length>0&&(
        <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
          <button onClick={selected.size===filtered.length?clearSel:selectAll} style={{
            padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',
            background:'transparent',color:C.muted,border:`1px solid ${C.border}`,fontFamily:'inherit',
          }}>{selected.size===filtered.length?'Tout désélect.':'Tout sélect.'}</button>
          {selected.size>0&&(<>
            {filter==='à imprimer'&&<button onClick={()=>handlePrintAll(selectedItems)} style={{
              padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',
              background:C.accent,color:'#fff',border:'none',fontFamily:'inherit',
            }}>🖨️ Imprimer ({selected.size})</button>}
            <button onClick={deleteSelected} style={{
              padding:'8px 14px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',
              background:'transparent',color:C.danger,border:`1.5px solid ${C.danger}`,fontFamily:'inherit',
            }}>🗑️ Supprimer ({selected.size})</button>
          </>)}
        </div>
      )}

      {filtered.length===0&&(
        <div style={{textAlign:'center',color:C.muted,padding:'40px 0',fontSize:13}}>
          {all.length===0
            ? 'Aucun bordereau reçu. Lance synchroniserVinted dans Apps Script.'
            : 'Aucun bordereau dans cette catégorie.'}
        </div>
      )}

      {filtered.map(b=>{
        const imprime=b.statut==='imprimé';
        const isSel=selected.has(b.id);
        const photo=photos&&photos[b.numero];
        const flagStr=paysFlag(b.pays);
        return (
          <div key={b.id} onClick={()=>toggleSelect(b.id)} style={{
            marginBottom:8,cursor:'pointer',
            background:isSel?C.accent+'12':C.card,
            border:`1.5px solid ${isSel?C.accent:C.border}`,
            borderRadius:12,overflow:'hidden',
            transition:'border-color .15s,background .15s',
            opacity:imprime?0.72:1,
          }}>
            <div style={{display:'flex',alignItems:'stretch'}}>
              {/* Photo ou placeholder grisé */}
              <div style={{
                width:82,flexShrink:0,position:'relative',
                background:photo?'#000':C.accent+'18',
                display:'flex',alignItems:'center',justifyContent:'center',
                minHeight:82,
              }}>
                {photo
                  ? <img src={photo} alt="" style={{width:82,height:'100%',objectFit:'cover',display:'block'}} onClick={e=>e.stopPropagation()}/>
                  : <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                      <div style={{fontSize:22,opacity:0.25}}>👟</div>
                      <div style={{fontSize:9,color:C.muted,opacity:0.6,fontWeight:600}}>PHOTO</div>
                    </div>
                }
                {/* Badge sélection */}
                <div style={{
                  position:'absolute',top:5,left:5,
                  width:20,height:20,borderRadius:5,
                  background:isSel?C.accent:'rgba(0,0,0,0.25)',
                  border:`1.5px solid ${isSel?'#fff':C.border}`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                }}>
                  {isSel&&<span style={{color:'#fff',fontSize:11,fontWeight:900,lineHeight:1}}>✓</span>}
                </div>
              </div>

              {/* Infos */}
              <div style={{flex:1,padding:'10px 12px',minWidth:0,display:'flex',flexDirection:'column',gap:3}}>
                <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                  <span style={{fontWeight:800,fontSize:14,color:C.accent}}>N°{b.numero||'?'}</span>
                  {b.taille&&<span style={{background:C.accent,color:'#fff',borderRadius:5,padding:'1px 7px',fontSize:11,fontWeight:700}}>T.{b.taille}</span>}
                  {imprime&&<span style={{background:'#8882',color:C.muted,borderRadius:5,padding:'1px 7px',fontSize:10,fontWeight:700}}>🗑️ Corbeille</span>}
                </div>
                <div style={{fontSize:13,color:C.text,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.modele||<span style={{color:C.muted,fontStyle:'italic',fontWeight:400}}>Modèle inconnu</span>}</div>
                {flagStr&&<div style={{fontSize:12,color:C.muted,fontWeight:500}}>{flagStr}</div>}
                <div style={{fontSize:11,color:C.muted,display:'flex',gap:10,flexWrap:'wrap',marginTop:1}}>
                  {b.dateLimite&&<span>⏰ {b.dateLimite}</span>}
                  {b.suivi&&<span style={{overflow:'hidden',textOverflow:'ellipsis',maxWidth:160}}>📦 {b.suivi}</span>}
                </div>
              </div>
            </div>

            {/* Boutons */}
            <div onClick={e=>e.stopPropagation()} style={{
              display:'flex',gap:6,padding:'8px 10px',
              borderTop:`1px solid ${C.border}`,
              background:C.surface+'80',
            }}>
              {b.id&&<button onClick={()=>handlePrint(b)} disabled={loadingPdf===b.id} style={{
                flex:1,padding:'7px 0',borderRadius:8,background:C.accent,color:'#fff',
                border:'none',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',
                opacity:loadingPdf===b.id?0.55:1,
              }}>{loadingPdf===b.id?'⏳':imprime?'🖨️ Réimprimer':'🖨️ Imprimer'}</button>}
              {imprime&&<button onClick={()=>restaurer(b.id)} style={{
                flex:1,padding:'7px 0',borderRadius:8,background:'transparent',
                color:C.accent,border:`1.5px solid ${C.accent}`,
                fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',
              }}>↩️ Restaurer</button>}
              <button onClick={()=>{
                if(imprime){
                  const u=all.filter(x=>x.id!==b.id);
                  setBordereaux(u);save('vinted_bordereaux',u);
                }else{
                  markImprime(b.id);
                }
              }} style={{
                width:36,padding:'7px 0',borderRadius:8,background:'transparent',
                color:C.danger,border:`1.5px solid ${C.danger}`,
                fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0,
              }}>🗑️</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [tab,setTab]=useState('dashboard');
  const [dark,setDark]=useState(()=>load('vinted_dark',false));
  // Applique le thème (clair/sombre) en réassignant C avant chaque rendu
  C = dark ? THEMES.dark : THEMES.light;
  const toggleDark=()=>{ const d=!dark; setDark(d); save('vinted_dark',d); };
  const [catalog,setCatalog]=useState(()=>{
    const s=load('vinted_catalog',null);
    if(!s||s.length===0){return INIT_CAT;}
    return s;
  });
  const [sales,setSales]=useState(()=>{
    const s=load('vinted_sales',null);
    if(!s||s.length===0){save('vinted_sales',INIT_SAL);return INIT_SAL;}
    return s;
  });
  const [garageGrid,setGarageGrid]=useState(()=>{
    const g=load('vinted_garage_grid',null);
    if(!g||Object.keys(g).length===0){save('vinted_garage_grid',INIT_GARAGE);return INIT_GARAGE;}
    return g;
  });
  const [blockedCells,setBlockedCells]=useState(()=>load('vinted_blocked',{}));
  const [extraCols,setExtraCols]=useState(()=>load('vinted_extracols',{}));
  const [cellColors,setCellColors]=useState(()=>load('vinted_colors',{}));
  const [invoices,setInvoices]=useState(()=>load('vinted_invoices',[]));
  const [stockVinted,setStockVinted]=useState(()=>load('vinted_stock_vinted',[]));
  const [notifEnabled,setNotifEnabled]=useState(()=>load('vinted_notif_enabled',false));
  const [notifBanner,setNotifBanner]=useState(null); // {ventes, factures} ou null
  const [menuOpen,setMenuOpen]=useState(false);
  const [invoiceSettings,setInvoiceSettings]=useState(()=>load('vinted_invoice_settings',{
    companyName:'Shop Cancale35',
    companyType:'Entrepreneur individuel',
    companyAddress:'80 rue de la vieille rivière 35260',
    siret:'94135104100012',
    footer:'Merci pour votre achat !',
  }));
  const [showBackup,setShowBackup]=useState(false);
  const [synced,setSynced]=useState(false);
  const [syncStatus,setSyncStatus]=useState('idle'); // idle | saving | synced | error | loading
  const [lastSync,setLastSync]=useState(null); // date de la dernière synchro réussie
  // Logo personnalisable : si l'utilisateur en charge un, il remplace le logo par défaut (header + factures)
  const [customLogo,setCustomLogo]=useState(()=>load('vinted_custom_logo',null));
  const [accounts,setAccounts]=useState(()=>load('vinted_accounts',INIT_ACCOUNTS));
  const [photos,setPhotos]=useState(()=>load('vinted_photos',{}));
  const [bordereaux,setBordereaux]=useState(()=>load('vinted_bordereaux',[]));
  const [appsScriptUrl,setAppsScriptUrl]=useState(()=>load('vinted_appsscript_url',''));
  const logoSrc = customLogo || LOGO_CANCALE;
  const logoInputRef = React.useRef(null);
  const handleLogoChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    if(!file.type.startsWith('image/')){ alert('Merci de choisir une image (jpg, png...)'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setCustomLogo(dataUrl);
      try{ localStorage.setItem('vinted_custom_logo', JSON.stringify(dataUrl)); cloudPush(); }catch(_){ alert("Image trop lourde pour être enregistrée. Essaie une image plus petite."); }
    };
    reader.onerror = () => alert("Impossible de lire l'image.");
    reader.readAsDataURL(file);
    e.target.value='';
  };
  const resetLogo = () => {
    if(window.confirm('Remettre le logo Cancale par défaut ?')){
      setCustomLogo(null);
      try{ localStorage.removeItem('vinted_custom_logo'); cloudPush(); }catch(_){}
    }
  };

  // Icône externe de l'app (onglet du navigateur + écran d'accueil) = le logo de l'app.
  // On met à jour dynamiquement les balises <link> d'icônes avec le logo courant
  // (ta photo si tu en as mis une, sinon le logo Cancale par défaut).
  useEffect(()=>{
    if(!logoSrc) return;
    const setIcon=(rel)=>{
      let link=document.querySelector(`link[rel="${rel}"]`);
      if(!link){ link=document.createElement('link'); link.rel=rel; document.head.appendChild(link); }
      link.href=logoSrc;
    };
    setIcon('icon');
    setIcon('shortcut icon');
    setIcon('apple-touch-icon');
  },[logoSrc]);
  
  // Au démarrage : charger depuis le cloud Supabase (synchro Mac <-> iPhone)
  // Si le cloud a des données, elles remplacent les données locales.
  // Le localStorage sert de secours si pas de connexion.
  // Demande automatiquement l'autorisation de notifications au démarrage.
  // Si l'utilisateur accepte, les notifications restent activées en permanence.
  // (Le navigateur impose ce consentement une seule fois ; on ne peut pas l'éviter.)
  useEffect(()=>{
    if(typeof Notification==='undefined') return;
    if(Notification.permission==='granted'){
      if(!notifEnabled){ setNotifEnabled(true); save('vinted_notif_enabled',true); }
    } else if(Notification.permission==='default'){
      askNotifPermission().then(res=>{
        if(res==='granted'){ setNotifEnabled(true); save('vinted_notif_enabled',true); }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(() => {
    let stop = false;
    // Écoute les changements de statut de synchro (saving / synced / error)
    const off = onSyncChange((st)=>{ if(!stop){ setSyncStatus(st); if(st==='synced') setLastSync(new Date()); } });
    setSyncStatus('loading');
    (async () => {
      const cloud = await cloudLoad();
      if (stop) return;
      if (cloud && Object.keys(cloud).length > 0) {
        // Applique les données du cloud à l'app + au localStorage
        const apply = (key, setter) => {
          if (cloud[key] !== undefined && cloud[key] !== null) {
            try { localStorage.setItem(key, JSON.stringify(cloud[key])); } catch(_){}
            setter(cloud[key]);
          }
        };
        apply('vinted_catalog', setCatalog);
        apply('vinted_sales', setSales);
        // Garage : migration automatique si anciennes clés détectées dans Firebase
        if (cloud.vinted_garage_grid) {
          const mig = migrateGarageData(cloud.vinted_garage_grid, cloud.vinted_blocked||{}, cloud.vinted_colors||{});
          if (mig) {
            // Anciennes clés détectées : appliquer les données migrées
            [['vinted_garage_grid',mig.garageGrid,setGarageGrid],['vinted_blocked',mig.blockedCells,setBlockedCells],
             ['vinted_colors',mig.cellColors,setCellColors],['vinted_extracols',mig.extraCols,setExtraCols]
            ].forEach(([k,v,s])=>{ try{localStorage.setItem(k,JSON.stringify(v));}catch{} s(v); });
            // Nettoyer Firebase : écraser avec données migrées + nullifier les anciennes clés
            const nullKeys={};
            OLD_ZONES.forEach(z=>{for(let ci=0;ci<z.cols;ci++) nullKeys[`${z.id}_${ci}`]=null;});
            fetch(FIREBASE_URL,{method:'PATCH',headers:{'Content-Type':'application/json'},
              body:JSON.stringify({vinted_garage_grid:{...mig.garageGrid,...nullKeys},
                vinted_blocked:mig.blockedCells,vinted_extracols:mig.extraCols,vinted_colors:mig.cellColors})
            }).catch(()=>{});
          } else {
            apply('vinted_garage_grid', setGarageGrid);
            apply('vinted_blocked', setBlockedCells);
            apply('vinted_extracols', setExtraCols);
            apply('vinted_colors', setCellColors);
          }
        } else {
          apply('vinted_blocked', setBlockedCells);
          apply('vinted_extracols', setExtraCols);
          apply('vinted_colors', setCellColors);
        }
        apply('vinted_invoices', setInvoices);
        apply('vinted_stock_vinted', setStockVinted);
        apply('vinted_invoice_settings', setInvoiceSettings);
        apply('vinted_custom_logo', setCustomLogo);
        apply('vinted_accounts', setAccounts);
        apply('vinted_bordereaux', setBordereaux);
        apply('vinted_appsscript_url', setAppsScriptUrl);
        setSyncStatus('synced');
        setLastSync(new Date());
      } else {
        // Cloud vide : on y envoie les données locales actuelles (1re utilisation)
        cloudPush();
      }
      setSynced(true);
    })();
    return () => { stop = true; off(); };
  }, []);

  // ── Automatismes Stock Vinted ──────────────────────────
  // On n'active ces effets qu'APRÈS le chargement initial (synced),
  // pour ne pas travailler sur des données encore vides/non synchronisées.

  // 1) Quand des factures existent, leur numéro de paire (productId) se retire
  //    automatiquement du Stock Vinted (la paire est vendue, donc plus en ligne).
  //    Si une facture est supprimée, son numéro n'est plus dans cette liste,
  //    donc il n'est plus retiré : il « revient » naturellement au prochain
  //    ajout manuel — et surtout on conserve les numéros sans facture.
  //    Pour gérer le RETOUR après suppression, on garde la trace des numéros
  //    retirés automatiquement (vinted_sv_auto_removed) afin de les réinjecter
  //    si leur facture disparaît.
  useEffect(()=>{
    if(!synced) return;
    const norm=v=>String(v||'').trim();
    const factureNums=new Set(invoices.flatMap(i=>norm(i.productId).split('+').map(norm)).filter(Boolean));
    let autoRemoved=load('vinted_sv_auto_removed',[]).map(norm);
    let stock=stockVinted.map(norm);
    let changed=false;

    // a) Retirer du stock les numéros qui ont désormais une facture
    const stillPresent=[];
    stock.forEach(n=>{
      if(factureNums.has(n)){
        if(!autoRemoved.includes(n)){ autoRemoved.push(n); }
        changed=true; // retiré
      } else {
        stillPresent.push(n);
      }
    });

    // b) Réinjecter les numéros précédemment retirés auto dont la facture a disparu
    const stillRemoved=[];
    autoRemoved.forEach(n=>{
      if(factureNums.has(n)){
        stillRemoved.push(n); // facture toujours là -> reste retiré
      } else {
        // facture supprimée -> le numéro revient au stock (s'il n'y est pas déjà)
        if(!stillPresent.includes(n)){ stillPresent.push(n); changed=true; }
      }
    });

    if(changed){
      // Dédoublonnage
      const finalStock=Array.from(new Set(stillPresent));
      setStockVinted(finalStock); save('vinted_stock_vinted',finalStock);
      save('vinted_sv_auto_removed',stillRemoved);
    }
  },[invoices,synced]);

  // 2) Nouveaux numéros ajoutés au catalogue À PARTIR DE MAINTENANT
  //    => ajout automatique au Stock Vinted.
  //    On initialise une liste de référence (vinted_sv_seen_catalog) avec
  //    tout le catalogue actuel au premier passage : rien n'est ajouté
  //    rétroactivement. Ensuite, chaque nouvel id du catalogue est ajouté.
  useEffect(()=>{
    if(!synced) return;
    const norm=v=>String(v||'').trim();
    const seenRaw=localStorage.getItem('vinted_sv_seen_catalog');
    const currentIds=catalog.map(p=>norm(p.id)).filter(Boolean);

    if(seenRaw===null){
      // Première initialisation : on mémorise l'état actuel sans rien ajouter
      save('vinted_sv_seen_catalog',currentIds);
      return;
    }
    let seen=[];
    try{ seen=JSON.parse(seenRaw)||[]; }catch(_){ seen=[]; }
    const seenSet=new Set(seen.map(norm));
    const factureNums=new Set(invoices.flatMap(i=>norm(i.productId).split('+').map(norm)).filter(Boolean));

    // Les nouveaux ids (pas encore vus)
    const nouveaux=currentIds.filter(id=>!seenSet.has(id));
    if(nouveaux.length>0){
      const stockSet=new Set(stockVinted.map(norm));
      let added=false;
      nouveaux.forEach(id=>{
        // On n'ajoute pas si déjà vendu (facture présente) ni déjà dans le stock
        if(!stockSet.has(id)&&!factureNums.has(id)){ stockSet.add(id); added=true; }
      });
      if(added){
        const finalStock=Array.from(stockSet);
        setStockVinted(finalStock); save('vinted_stock_vinted',finalStock);
      }
      // Mémoriser tous les ids vus (anciens + nouveaux)
      save('vinted_sv_seen_catalog',currentIds);
    } else {
      // Garder la liste vue à jour (au cas où des ids auraient été retirés)
      save('vinted_sv_seen_catalog',currentIds);
    }
  },[catalog,synced]);

  // ── Notifications : ventes comptabilisées + factures reçues ──
  // Après chargement, on compare le nombre actuel de ventes (=comptabilisées)
  // et de factures avec les derniers compteurs mémorisés. S'il y a du nouveau,
  // on envoie une notification navigateur + on affiche un bandeau dans l'app.
  useEffect(()=>{
    if(!synced) return;
    const prevV=parseInt(localStorage.getItem('vinted_notif_last_sales')||'-1',10);
    const prevF=parseInt(localStorage.getItem('vinted_notif_last_invoices')||'-1',10);
    const curV=sales.length;
    const curF=invoices.length;

    // Première initialisation : on mémorise sans notifier
    if(prevV<0||prevF<0){
      save('vinted_notif_last_sales',curV);
      save('vinted_notif_last_invoices',curF);
      return;
    }

    const newV=Math.max(0,curV-prevV);
    const newF=Math.max(0,curF-prevF);

    if((newV>0||newF>0)){
      // Bandeau in-app (toujours affiché, même si les notifs système sont off)
      setNotifBanner({ventes:newV, factures:newF});

      // Notification navigateur si activée
      if(notifEnabled){
        if(newV>0&&newF>0){
          pushNotif('Shop Cancale35', `${newV} vente${newV>1?'s':''} comptabilisée${newV>1?'s':''} et ${newF} facture${newF>1?'s':''} reçue${newF>1?'s':''}.`);
        } else if(newV>0){
          pushNotif('Vente comptabilisée', `${newV} nouvelle${newV>1?'s':''} vente${newV>1?'s':''} en comptabilité.`);
        } else if(newF>0){
          pushNotif('Nouvelle facture', `${newF} nouvelle${newF>1?'s':''} facture${newF>1?'s':''} reçue${newF>1?'s':''}.`);
        }
      }
    }

    // Mémoriser les nouveaux compteurs
    save('vinted_notif_last_sales',curV);
    save('vinted_notif_last_invoices',curF);
  },[sales,invoices,synced,notifEnabled]);

  return (
    <div style={{minHeight:'100vh',width:'100%',maxWidth:'100vw',overflowX:'hidden',background:C.bg,color:C.text,fontFamily:"'Nunito','Instrument Sans',system-ui,sans-serif",paddingBottom:80,transition:'background .3s,color .3s',boxSizing:'border-box'}}>
      <header style={{position:'sticky',top:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:C.surface,borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {/* Logo Cancale Shoes Store - cliquable pour le changer */}
          <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{display:'none'}}/>
          <div
            onClick={()=>logoInputRef.current&&logoInputRef.current.click()}
            onContextMenu={(e)=>{e.preventDefault();resetLogo();}}
            title="Cliquer pour changer le logo (clic droit / appui long = remettre par défaut)"
            style={{position:'relative',width:42,height:42,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,borderRadius:6,overflow:'hidden',cursor:'pointer'}}>
            <img src={logoSrc} alt="Cancale" style={{width:42,height:42,objectFit:'cover'}}/>
            <div style={{position:'absolute',bottom:0,left:0,right:0,height:13,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff'}}>✎</div>
          </div>
          <div>
            <div style={{fontWeight:900,fontSize:19,color:C.accent,letterSpacing:-0.3,lineHeight:1}}>Cancale</div>
            <div style={{fontSize:9,color:C.muted,letterSpacing:2.5,textTransform:'uppercase',marginTop:3,fontWeight:600}}>Shoes Store</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div style={{fontSize:12,display:'flex',gap:12,alignItems:'center'}}>
            <span title={
              syncStatus==='synced'?'Synchronisé avec le cloud':
              syncStatus==='saving'?'Sauvegarde en cours...':
              syncStatus==='loading'?'Chargement...':
              syncStatus==='error'?'Hors ligne (sauvegarde locale)':'En attente'
            } style={{fontSize:13,opacity:0.9,display:'flex',alignItems:'center',gap:4}}>
              {syncStatus==='synced'?'☁️':syncStatus==='saving'||syncStatus==='loading'?'🔄':syncStatus==='error'?'⚠️':'☁️'}
              {lastSync&&syncStatus==='synced'&&(
                <span style={{fontSize:9,color:C.muted,fontWeight:600}}>
                  {String(lastSync.getHours()).padStart(2,'0')}:{String(lastSync.getMinutes()).padStart(2,'0')}
                </span>
              )}
            </span>
          </div>
          {/* Boutons Mode sombre / Exporter / Importer */}
          <div style={{display:'flex',gap:6}}>
            <button type="button" onClick={toggleDark} title={dark?'Mode clair':'Mode sombre'}
              style={{background:'transparent',border:`1px solid ${C.border}`,borderRadius:999,padding:'6px 11px',color:C.text,cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit'}}>
              {dark?'☀️':'🌙'}
            </button>
            <button type="button" onClick={async()=>{
              if(!notifEnabled){
                const res=await askNotifPermission();
                if(res==='granted'){
                  setNotifEnabled(true); save('vinted_notif_enabled',true);
                  pushNotif('Notifications activées','Tu seras prévenu des ventes comptabilisées et des factures reçues.');
                } else if(res==='denied'){
                  alert("Les notifications sont bloquées par ton navigateur. Pour les activer : réglages du navigateur > Notifications > autorise le site.");
                } else if(res==='unsupported'){
                  alert("Ton navigateur ne supporte pas les notifications. Tu verras quand même le bandeau dans l'app.");
                }
              } else {
                setNotifEnabled(false); save('vinted_notif_enabled',false);
              }
            }} title={notifEnabled?'Notifications activées (cliquer pour désactiver)':'Activer les notifications'}
              style={{background:notifEnabled?C.accent:'transparent',border:`1px solid ${notifEnabled?C.accent:C.border}`,borderRadius:999,padding:'6px 11px',color:notifEnabled?C.onAccent:C.text,cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit'}}>
              {notifEnabled?'🔔':'🔕'}
            </button>
            <button type="button" onClick={()=>{
              try {
                const data={catalog,sales,garageGrid,exportDate:new Date().toISOString()};
                const json=JSON.stringify(data,null,2);
                const blob=new Blob([json],{type:'application/json'});
                const url=URL.createObjectURL(blob);
                const a=document.createElement('a');
                const date=new Date().toISOString().slice(0,10);
                a.href=url;
                a.download=`cancale-backup-${date}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch(err) {
                alert('Erreur export : '+err.message);
              }
            }} title="Télécharger une sauvegarde"
              style={{background:'transparent',border:`1px solid ${C.accent}66`,borderRadius:999,padding:'6px 12px',color:C.accent,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit'}}>
              📤 Exporter
            </button>
            <button type="button" onClick={()=>{
              const inp=document.createElement('input');
              inp.type='file';
              inp.accept='.json,application/json';
              inp.onchange=async(e)=>{
                const file=e.target.files[0];
                if(!file) return;
                try {
                  const text=await file.text();
                  const data=JSON.parse(text);
                  if(!data.catalog&&!data.sales&&!data.garageGrid){
                    alert('⚠ Fichier invalide : aucun catalogue/ventes/garage trouvé.');
                    return;
                  }
                  let msg='Importer ce fichier ?\n\n';
                  if(data.catalog) msg+=`📦 Catalogue : ${data.catalog.length} paires\n`;
                  if(data.sales) msg+=`💸 Ventes : ${data.sales.length} ventes\n`;
                  if(data.garageGrid) msg+=`🏠 Garage : ${Object.values(data.garageGrid).flatMap(a=>Array.isArray(a)?a:[]).filter(v=>v&&v.trim()!=='').length} paires\n`;
                  msg+='\n⚠ Tes données actuelles seront REMPLACÉES.';
                  if(!window.confirm(msg)) return;
                  if(data.catalog) {setCatalog(data.catalog); save('vinted_catalog',data.catalog);try{localStorage.setItem('vinted_sv_seen_catalog',JSON.stringify(data.catalog.map(p=>String(p.id||'').trim()).filter(Boolean)));}catch{}}
                  if(data.sales) {setSales(data.sales); save('vinted_sales',data.sales);}
                  if(data.garageGrid) {
                    const mig = migrateGarageData(data.garageGrid, data.blockedCells, data.cellColors);
                    const g = mig ? mig.garageGrid : data.garageGrid;
                    const b = mig ? mig.blockedCells : (data.blockedCells||{});
                    const co = mig ? mig.cellColors : (data.cellColors||{});
                    const ec = data.extraCols || (mig ? mig.extraCols : (() => { const e={}; Object.keys(g).forEach(k=>{const m=k.match(/^(.+)_(\d+)$/);if(m)e[m[1]]=Math.max(e[m[1]]||0,+m[2]);}); return e; })());
                    setGarageGrid(g); save('vinted_garage_grid',g);
                    setBlockedCells(b); save('vinted_blocked',b);
                    setCellColors(co); save('vinted_colors',co);
                    setExtraCols(ec); save('vinted_extracols',ec);
                  } else {
                    if(data.blockedCells) {setBlockedCells(data.blockedCells); save('vinted_blocked',data.blockedCells);}
                    if(data.extraCols) {setExtraCols(data.extraCols); save('vinted_extracols',data.extraCols);}
                    if(data.cellColors) {setCellColors(data.cellColors); save('vinted_colors',data.cellColors);}
                  }
                  alert('✓ Import réussi !');
                } catch(err) {
                  alert('Erreur lecture du fichier : '+err.message);
                }
              };
              inp.click();
            }} title="Importer une sauvegarde"
              style={{background:'transparent',border:`1px solid ${C.blue}66`,borderRadius:999,padding:'6px 12px',color:C.blue,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit'}}>
              📥 Importer
            </button>
          </div>
        </div>
      </header>
      {/* Bandeau de notification in-app */}
      {notifBanner&&(notifBanner.ventes>0||notifBanner.factures>0)&&(
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'10px 16px',background:C.accent,color:C.onAccent,fontSize:13,fontWeight:700}}>
          <span>
            🔔 {notifBanner.ventes>0&&`${notifBanner.ventes} vente${notifBanner.ventes>1?'s':''} comptabilisée${notifBanner.ventes>1?'s':''}`}
            {notifBanner.ventes>0&&notifBanner.factures>0&&' · '}
            {notifBanner.factures>0&&`${notifBanner.factures} facture${notifBanner.factures>1?'s':''} reçue${notifBanner.factures>1?'s':''}`}
          </span>
          <button onClick={()=>setNotifBanner(null)} style={{background:'transparent',border:'none',borderRadius:6,color:C.onAccent,cursor:'pointer',fontSize:16,fontWeight:900,padding:'2px 9px',lineHeight:1,opacity:0.8}}>×</button>
        </div>
      )}
      <Nav tab={tab} setTab={setTab}/>
      <main style={{maxWidth:1200,margin:'0 auto'}}>
        {tab==='dashboard'&&<Dashboard catalog={catalog} sales={sales} garageGrid={garageGrid} invoices={invoices} accounts={accounts}/>}
        {tab==='catalog'  &&<Catalog   catalog={catalog} setCatalog={setCatalog} accounts={accounts} photos={photos} setPhotos={setPhotos} onDeleteId={(id)=>{
          const norm=v=>String(v||'').trim();
          const n=norm(id);
          const u=stockVinted.filter(x=>norm(x)!==n);
          setStockVinted(u); save('vinted_stock_vinted',u);
          try{const ar=load('vinted_sv_auto_removed',[]).filter(x=>norm(x)!==n);localStorage.setItem('vinted_sv_auto_removed',JSON.stringify(ar));}catch{}
        }}/>}
        {tab==='sales'      &&<Sales     catalog={catalog} setCatalog={setCatalog} sales={sales} setSales={setSales} invoices={invoices} invoiceSettings={invoiceSettings} accounts={accounts}/>}
        {tab==='invoices'   &&<Invoices  invoices={invoices} setInvoices={setInvoices} catalog={catalog} sales={sales} setSales={setSales} invoiceSettings={invoiceSettings} setInvoiceSettings={setInvoiceSettings}/>}
        {tab==='stockvinted'&&<StockVinted stockVinted={stockVinted} setStockVinted={setStockVinted} garageGrid={garageGrid} invoices={invoices} accounts={accounts} catalog={catalog}/>}
        {tab==='bordereaux' &&<BordereauxView bordereaux={bordereaux} setBordereaux={setBordereaux} appsScriptUrl={appsScriptUrl} photos={photos} catalog={catalog} sales={sales} setSales={setSales}/>}
        {tab==='garage'     &&<Garage    catalog={catalog} garageGrid={garageGrid} setGarageGrid={setGarageGrid} blockedCells={blockedCells} setBlockedCells={setBlockedCells} extraCols={extraCols} setExtraCols={setExtraCols} cellColors={cellColors} setCellColors={setCellColors} accounts={accounts}/>}
        {tab==='params'     &&<AccountsSettings accounts={accounts} setAccounts={setAccounts} appsScriptUrl={appsScriptUrl} setAppsScriptUrl={setAppsScriptUrl}/>}
      </main>
      {showBackup&&<BackupModal
        catalog={catalog} sales={sales} garageGrid={garageGrid} blockedCells={blockedCells} extraCols={extraCols} cellColors={cellColors}
        onClose={()=>setShowBackup(false)}
        onImport={(data)=>{
          if(data.catalog){setCatalog(data.catalog);save('vinted_catalog',data.catalog);try{localStorage.setItem('vinted_sv_seen_catalog',JSON.stringify(data.catalog.map(p=>String(p.id||'').trim()).filter(Boolean)));}catch{}}
          if(data.sales){setSales(data.sales);save('vinted_sales',data.sales);}
          if(data.garageGrid){
            const mig=migrateGarageData(data.garageGrid,data.blockedCells,data.cellColors);
            const g=mig?mig.garageGrid:data.garageGrid;
            const b=mig?mig.blockedCells:(data.blockedCells||{});
            const co=mig?mig.cellColors:(data.cellColors||{});
            const ec=data.extraCols||(mig?mig.extraCols:(()=>{const e={};Object.keys(g).forEach(k=>{const m=k.match(/^(.+)_(\d+)$/);if(m)e[m[1]]=Math.max(e[m[1]]||0,+m[2]);});return e;})());
            setGarageGrid(g);save('vinted_garage_grid',g);
            setBlockedCells(b);save('vinted_blocked',b);
            setCellColors(co);save('vinted_colors',co);
            setExtraCols(ec);save('vinted_extracols',ec);
          } else {
            if(data.blockedCells){setBlockedCells(data.blockedCells);save('vinted_blocked',data.blockedCells);}
            if(data.extraCols){setExtraCols(data.extraCols);save('vinted_extracols',data.extraCols);}
            if(data.cellColors){setCellColors(data.cellColors);save('vinted_colors',data.cellColors);}
          }
          setShowBackup(false);
          alert('✓ Restauration réussie !');
        }}
      />}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Instrument+Sans:wght@400;500;600;700&display=swap');
        html, body, #root { max-width: 100%; overflow-x: hidden; margin: 0; }
        * { box-sizing: border-box; }
        @media (max-width: 600px) {
          table { font-size: 11px !important; }
          table td, table th { padding: 4px 4px !important; }
          h2 { font-size: 16px !important; }
          .card-pad { padding: 12px !important; }
        }
      `}</style>
    </div>
  );
}
