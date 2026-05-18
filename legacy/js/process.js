

function Calc_StatsGroupsCount(stats3C3R, queue)
{
    stats3C3R.Reset(6);

    var nCalcCount = g_bttnStatsGroups.Value();
    var nCount = 0;

    for (var n = queue.nIDX; n >= 0; --n)
    {
        if (queue.anNum[n] == 0)
            continue;

        var numQ = queue.anNum[n];
        var nCol = GetNumCol(numQ);
        var nRow = GetNumRow(numQ);

        stats3C3R.anValue[nCol]++;
        stats3C3R.anValue[nRow + 3]++;

        ++nCount;
        if (nCount >= nCalcCount)
            break;
    }

    stats3C3R.Sort(true);
}

function ChangeTheme(theme)
{
    var csslink = document.getElementById("linkTheme");
    csslink.href = "css/" + theme + ".css";
}

function Show_RefreshTheme()
{
    var strTitle = "淡雅";

    if (g_status.ThemeID == 0)
    {
        strTitle = "彩色";
    }
    var bttn = document.getElementById("tdBttnTheme");
    bttn.innerHTML = strTitle;

    ChangeTheme((g_status.ThemeID == 0) ? "normal" : "color");

    //Show_3C3R();
}

function Show3C3RItem(n, nValue, nIdx)
{
    var strIdTd = "td3C3R" + n.toString();
    var td = document.getElementById(strIdTd);
    td.innerHTML = nValue.toString();
    strIdTd = "tdT3C3R" + n.toString();
    var strTitle = GetColRowSpec(nIdx);
    var tdT = document.getElementById(strIdTd);
    tdT.innerHTML = strTitle;

    if (nValue >= 5)
    {
        if (nValue > 5)
        {
            td.className = "td3C3R_v td3C3RV6";
            tdT.className = "td3C3R_t td3C3RT6";
        }
        else
        {
            td.className = "td3C3R_v td3C3RV5";
            tdT.className = "td3C3R_t td3C3RT5";
        }
        td.style.fontWeight = "bold";
    }
    else
    {
        td.className = "td3C3R_v td3C3RV";
        tdT.className = "td3C3R_t td3C3RT";

        td.style.fontWeight = "normal";
    }
}

function Show_3C3R()
{
    g_3C3R.data.Sort(false);

    if (g_status.Seperate3C3R == "F")
    {
        for (var n = 0; n < 6; ++n)
            Show3C3RItem(n, g_3C3R.data.Value(n), g_3C3R.data.anIdx[n]);
    }
    else
    {
        var nn = 0;
        for (var n = 0; n < 6; ++n)
        {
            if (g_3C3R.data.anIdx[n] < 3)
            {
                Show3C3RItem(nn, g_3C3R.data.Value(n), g_3C3R.data.anIdx[n]);
                ++nn;
            }
        }

        for (var n = 0; n < 6; ++n)
        {
            if (g_3C3R.data.anIdx[n] >= 3)
            {
                Show3C3RItem(nn, g_3C3R.data.Value(n), g_3C3R.data.anIdx[n]);
                ++nn;
            }
        }
    }

    var strDisplay = "";
    var strDisplayOther = "none";

    if (g_queue.nIDX >= 0)
    {
        strDisplay = "none";
        strDisplayOther = "";
    }

    var strID1 = "td3C3R2";
    var strID1Other = "td3C3R4";

    if (g_status.Seperate3C3R == "F")
    {
        strID1 = "td3C3R4";
        strID1Other = "td3C3R2";
    }

    var td1 = document.getElementById(strID1);
    var td1Other = document.getElementById(strID1Other);
    var td2 = document.getElementById("td3C3R5");

    td1.style.display = strDisplay;
    td1Other.style.display = strDisplayOther;
    td2.style.display = strDisplay;
}

function GetColumnSpec(nIdx)
{
    return g_columns.anStart[nIdx].toString() + "-" + (g_columns.anStart[nIdx] + 5).toString();
}


function Show_Columns()
{
    var nMin = g_bttnColumns.Value();
    var nColumnCount = g_columns.anStart.length;
    var nCount = 0;

    for (var n = 0; n < nColumnCount; ++n)
    {
        if (g_columns.data.Value(n) < nMin)
            break;

        ++nCount;
    }

    var tbl = document.getElementById("tblColumns");
    var tr1 = document.getElementById("trColumns1");
    var tr2 = document.getElementById("trColumns2");

    tbl.style.display = "";
    tr1.style.display = "";
    tr2.style.display = "";

    if (nCount <= 0)
    {
        tbl.style.display = "none";
        return;
    }
    else
    {
        if (nCount <= 4)
        {
            tr1.style.display = "none";
            tr2.style.display = "none";
        }
        else if (nCount <= 8)
        {
            tr2.style.display = "none";
        }
    }

    var anActive = [];
    for (var n = 0; n < nCount; ++n)
        anActive[n] = 1;

    for (var n = 0; n < nCount - 1; ++n)
    {
        if (anActive[n] == 0)
            continue;

        if ((g_columns.data.anIdx[n] % 2) != 0)
            continue;

        for (var nn = n + 1; nn < nCount; ++nn)
        {
            var nMinIdx = Math.min(g_columns.data.anIdx[n], g_columns.data.anIdx[nn]);
            var nMaxIdx = Math.max(g_columns.data.anIdx[n], g_columns.data.anIdx[nn]);

            if (((nMinIdx % 4) == 0) && ((nMaxIdx - nMinIdx) == 2))
            {
                anActive[n] = 0;
                anActive[nn] = 0;
                break;
            }
        }
    }

    for (var n = 0; n < 12; ++n)
    {
        var tdT = document.getElementById("tdColumnsT" + n.toString());
        var tdV = document.getElementById("tdColumnsV" + n.toString());

        if (n >= nCount)
        {
            tdT.innerHTML = "&nbsp;";
            tdV.innerHTML = "&nbsp;";
            tdT.className = "Title Empty";
            tdV.className = "Value Empty";
        }
        else
        {
            tdT.innerHTML = GetColumnSpec(g_columns.data.anIdx[n]);
            tdV.innerHTML = g_columns.data.Value(n).toString();

            if (anActive[n] == 1)
            {
                tdT.className = "Title TActive";
                tdV.className = "Value VActive";
            }
            else
            {
                tdT.className = "Title TInactive";
                tdV.className = "Value VInactive";
            }
        }
    }
}

function Show_FinishedLong()
{
    var MIN_LONG_COUNT = 10;

    var abOccur = [];
    abOccur[0] = [];
    abOccur[1] = [];

    var anCount = [];
    anCount[0] = [];
    anCount[1] = [];

    var anIndex = [];

    for (var n = 0; n < 6; ++n)
    {
        abOccur[0][n] = false;
        abOccur[1][n] = false;
        anCount[0][n] = 0;
        anCount[1][n] = 0;
        anIndex[n] = n;
    }

    var bHaveLong = false;

    for (var n = g_queue.nIDX; n >= 0; --n)
    {
        var anIdx = [];
        anIdx[0] = GetNumCol(g_queue.anNum[n]);
        anIdx[1] = GetNumRow(g_queue.anNum[n]) + 3;

        var bContinue = false;

        for(var n1 = 0; n1 < 2; ++ n1)
        {
            if (abOccur[1][anIdx[n1]])
                continue;

            if (abOccur[0][anIdx[n1]])
            {
                abOccur[1][anIdx[n1]] = true;
                continue;
            }

            abOccur[0][anIdx[n1]] = true;
        }

        for(var nn = 0; nn < 6; ++ nn)
        {
            if ((nn == anIdx[0]) || (nn == anIdx[1]))
                continue;

            if (abOccur[1][nn])
                continue;

            bContinue = true;

            if (abOccur[0][nn])
            {
                anCount[1][nn]++;
                if ((anCount[1][nn]) >= MIN_LONG_COUNT)
                    bHaveLong = true;
            }
            else
            {
                anCount[0][nn]++;
            }
        }

        if (!bContinue)
            break;
    }

    var div = document.getElementById("divFinishedLong");

    var strDisplay = "";
    if (!bHaveLong)
    {
        strDisplay = "none";
    }
    else
    {
        DoSort(anCount[0], anIndex, true);

        var strHtml = "刚结束：&nbsp;&nbsp;";

        for (var n = 0; n < 6; ++n)
        {
            var nIdx = anIndex[n];
            if (anCount[1][nIdx] >= MIN_LONG_COUNT)
            {
                strHtml += GetColRowSpec(nIdx) + "&nbsp;&nbsp;";
                strHtml += "<span class='txtLongCount'>" + anCount[1][nIdx].toString() + "</span>&nbsp;&nbsp;";
                strHtml += anCount[0][nIdx].toString() + ";&nbsp;&nbsp;&nbsp;&nbsp;";
            }
        }

        div.innerHTML = strHtml;
    }

    div.style.display = strDisplay;
}

function Show_Queue()
{
    var nStart = 0;
    if (g_queue.nIDX > QUEUE_MAX_COUNT)
        nStart = g_queue.nIDX - QUEUE_MAX_COUNT + 1;

    for (var n = nStart; n <= g_queue.nIDX; ++n)
    {
        var nn = (n - nStart);
        var nIdx = g_queue.nIDX - nn;

        var strIdTd = "td" + nn.toString();
        var td = document.getElementById(strIdTd);
        td.innerHTML = g_queue.anNum[nIdx];
        td.className = GetNumberClass(g_queue.anNum[nIdx]);
    }

    for (var n = g_queue.nIDX + 1; n < QUEUE_MAX_COUNT; ++n)
    {
        var strIdTd = "td" + n.toString();
        var td = document.getElementById(strIdTd);
        td.innerHTML = "&nbsp;";
        td.className = "Empty";
    }

    var nQueueRow = 0;

    if (g_queue.nIDX >= 0)
    {
        nQueueRow = Math.floor((g_queue.nIDX - nStart) / QUEUE_LINE_NUM_COUNT) + 1;
    }

    if (g_queue.nIDX < QUEUE_LINE_NUM_COUNT)
    {
        g_status.QueueExpand = 0;
    }

    var nLineCount = (QUEUE_MAX_COUNT / QUEUE_LINE_NUM_COUNT).toFixed(0);

    for (var n = 1; n <= nLineCount; ++n)
    {
        var strID = "trRow" + n.toString();
        var tr = document.getElementById(strID);
        if ((nQueueRow > 0) && ((n == 1) || ((n <= nQueueRow) && (g_status.QueueExpand == 1))))
            tr.style.display = "";
        else
            tr.style.display = "none";
    }
}

function Show_RefreshSysButtons()
{
    var astrIDBttn = [
        "tdBttnTheme", "tdBttnPlay", "tdBttnExport", "tdBttnImport",
        "tdBttnSave", "tdBttnManage", "tdBttnConfig",

        "tdBttnRestore", "tdBttnStatsGames", "tdBttnStatsColRow", "tdBttnStatsFrequencies",
        "tdBttnStatsDistances", "tdBttnStatsColRowDig", "tdBttnStatistics"
        ];

    var abEnabled = [];

    for (var n = 0; n < astrIDBttn.length; ++n)
    {
        abEnabled[n] = true;
    }

    if (g_queue.nIDX < 0)
    {
        // abEnabled[1] = false; // restart ////////// currently not used
        abEnabled[2] = false; // export
        abEnabled[4] = false; // save
        abEnabled[8] = false; // stats games
        abEnabled[9] = false; // stats colrow
        abEnabled[10] = false; // stats frequencies
        abEnabled[11] = false; // stats distances
        abEnabled[12] = false; // stats colrow dig
        abEnabled[13] = false; // statistics
    }
    else
    {
        abEnabled[7] = false; // restore
    }

    if (g_queue.nIDX < 1)
        abEnabled[1] = false; // play

    if (g_queue.nIDX < 1)
        abEnabled[10] = false; // stats frequencies

    for (var n = 0; n < astrIDBttn.length; ++n)
    {
        var bttn = document.getElementById(astrIDBttn[n]);
        bttn.className = abEnabled[n] ? "tdSBEnabled" : "tdSBDisabled";
    }
}

function Calc_AddNum(num)
{
    g_queue.AddNum(num);
    g_3C3R.AddNum(num);
    g_waves.AddNum(num);
}

function Calc_Sum()
{
    g_columns.ReCalc(g_queue);
}

function Show_AddNum()
{
    Show_Queue();
    Show_3C3R();
    Show_Columns();
    Show_FinishedLong();
    Show_StatsGroupsCount();
    Show_RefreshSysButtons();
    Show_SumLists();
    Show_StatsGames(-1, true); // 打法（主页）
}

function Play_Show_AddNum()
{
    Show_StatsGames(-1, false);    // 打法（非主页）
    Show_StatsColRowDetail();      // 行组 - 明细

    g_waves.CalcCRC();
    Show_StatsColRowChart();       // 行组 - 统计图
    Show_StatsColRowSum();         // 行组 - 统计数据

    Show_StatsFrequencies();       // 频率 - 多行组单区域
    Show_StatsFrequenciesDetail(); // 频率 - 单行组多区域
    Show_StatsDistances();         // 距离
    Show_StatsColRowDig();         // 细化
    Show_StatsNumbers(-1);         // 其它 - 号码
    Show_StatsLongs();             // 其它 - 追打
    Show_StatsRounds();            // 其它 - 轮次 - 轮次统计数据
    Show_StatsRoundBet();          // 其它 - 轮次 - 轮次参考数据
}

function PageInit_Data(bCleanAll)
{
    g_3C3R.Reset();
    g_columns.Reset();
    g_status.Reset();
    g_queue.Reset();

    g_waves.Reset(g_bttnStatsScope.Value());

    if(!bCleanAll)
        return;

    var nLen = g_anDelNum.length;
    if(nLen > 0)
        g_anDelNum.splice(0, nLen);
}


function Init_Theme()
{
    for (var n = 0; n <= 36; ++n)
    {
        var tdK = document.getElementById("tdK" + n.toString());
        tdK.className = GetNumberClass(n);

        var tdB = document.getElementById("tdB" + n.toString());
        tdB.className = GetNumberClass(n);
    }
}



function Show_Keyboard(bShow)
{
    /*
    var strDisplay = "";

    if (!bShow)
        strDisplay = "none";

    var strID = "divGameBoard";
    var strIDAnother = "divKeyboard";

    if (g_status.KeyboardID == "K")
    {
        var strID = "divKeyboard";
        var strIDAnother = "divGameBoard";
    }

    var div = document.getElementById(strID);
    div.style.display = strDisplay;

    div = document.getElementById(strIDAnother);
    div.style.display = "none";
    */

    var strIDAnother = "divKeyboard";

    if (g_status.KeyboardID == "K")
        var strIDAnother = "divGameBoard";

    var div = document.getElementById(strIDAnother);
    div.style.display = "none";

    div = document.getElementById("divMainBottom");
    div.style.display = bShow ? "" : "none";;

    var divKB = document.getElementById("divShowKeyboard");
    divKB.style.display = bShow ? "none" : "";
}


function SaveNumbers()
{
    var strNum = NumArrayToString(g_queue);
    WriteData(DATA_NUMBERS, strNum);
}



function TitleString_StatsGroupsCount(strTitle)
{
    return "<span class='SGCTitle'>" + strTitle + "</span>"
}

function NumberString_StatsGroupsCount(nNum)
{
    return "<span class='SGCNumber'>" + nNum.toString() + "</span>"
}


function Show_StatsGroupsCount()
{
    var stats3C3R = new CIndexedArray();
    Calc_StatsGroupsCount(stats3C3R, g_queue);

    var div = document.getElementById("divStatsGroups");
    var strDisplay = "";
    if (g_queue.nIDX < 0)
        strDisplay = "none";
    div.style.display = strDisplay;

    var tdCol = document.getElementById("tdStatsGroupsCol");
    var strHtml = "";
    var bFirst = true;
    for (var n = 0; n < 6; ++n)
    {
        var nIdx = stats3C3R.anIdx[n];
        if (nIdx >= 3)
            continue;

        if (!bFirst)
            strHtml += "&nbsp;&nbsp;";
        bFirst = false;

        strHtml += TitleString_StatsGroupsCount(GetColRowSpec(nIdx)) + "&nbsp;";
        strHtml += NumberString_StatsGroupsCount(stats3C3R.anValue[nIdx]);
    }
    tdCol.innerHTML = strHtml;

    strHtml = "";
    var tdRow = document.getElementById("tdStatsGroupsRow");
    bFirst = true;
    for (var n = 0; n < 6; ++n)
    {
        var nIdx = stats3C3R.anIdx[n];
        if (nIdx < 3)
            continue;

        if (!bFirst)
            strHtml += "&nbsp;&nbsp;";
        bFirst = false;

        strHtml += TitleString_StatsGroupsCount(GetColRowSpec(nIdx)) + "&nbsp;";
        strHtml += NumberString_StatsGroupsCount(stats3C3R.anValue[nIdx]);
    }
    tdRow.innerHTML = strHtml;

    ShowStatsBisections();
}

function ShowStatsBisections()
{
    var anCountRB = [0, 0];
    var anCountOE = [0, 0];
    var anCountBS = [0, 0];

    var nCalcCount = g_bttnStatsGroups.Value();
    var nCount = 0;

    for (var n = g_queue.nIDX; n >= 0; --n)
    {
        var numQ = g_queue.anNum[n];

        if (numQ == 0)
            continue;

        if (g_astrNumberColor[numQ] == "r")
            anCountRB[0] += 1;
        else
            anCountRB[1] += 1;

        if((numQ % 2) == 1)
            anCountOE[0] += 1;
        else
            anCountOE[1] += 1;

        if (numQ > 18)
            anCountBS[0] += 1;
        else
            anCountBS[1] += 1;

        ++nCount;
        if (nCount >= nCalcCount)
            break;
    }

    var tdColRB = document.getElementById("tdStatsBisectionRBValue");
    tdColRB.innerHTML = anCountRB[0].toString() + "&nbsp;:&nbsp;" + anCountRB[1].toString();

    var tdColOE = document.getElementById("tdStatsBisectionOEValue");
    tdColOE.innerHTML = anCountOE[0].toString() + "&nbsp;:&nbsp;" + anCountOE[1].toString();

    var tdColBS = document.getElementById("tdStatsBisectionBSValue");
    tdColBS.innerHTML = anCountBS[0].toString() + "&nbsp;:&nbsp;" + anCountBS[1].toString();
}

function ResetData(anNum, bCleanAll)
{
    PageInit_Data(bCleanAll);

    for (var n = 0; n < anNum.length; ++n)
        Calc_AddNum(anNum[n]);

    Calc_Sum();

    Show_AddNum();
}

// bImport - true: import; false: retore
function ResetDataFromNumString(strNum, strAction, AfterResetData)
{
    var strMsgTitle = (strAction == "import") ? "导入数据" : ((strAction == "restore") ? "恢复数据" : "打开数据");
    if ((strNum == undefined) || (strNum == null))
    {
        jAlert("没有找到要导入的数据", strMsgTitle);
        return;
    }

    var rtn = new CReturnArray();
    NumStringToArray(strNum, rtn);

    var strMsg = "";

    if (rtn.rn < 0)
    {
        if (strAction == "import")
            strMsg = "要导入的数据不正确，请检查！";
        else
            strMsg = "保存的数据可能已经损坏";

        jAlert(strMsg, strMsgTitle);
        return;
    }
    else if (rtn.rn == 0)
    {
        if (strAction == "import")
            strMsg = "请在输入框中输入要导入的数据！";
        else
            strMsg = "没有找到保存的数据";

        jAlert(strMsg, strMsgTitle);
        return;
    }

    strMsg = "";
    if (strAction == "import")
    {
        if (g_queue.nIDX >= 0)
            strMsg = "导入将清除当前数据！";
        else
            strMsg = "系统将使用导入的数据，";

        strMsg += "确定要导入吗？"
    }
    else if (strAction == "restore")
    {
        strMsg = "确定要恢复吗？";
    }
    else
    {
        if (g_queue.nIDX >= 0)
            strMsg = "打开将清除当前数据！";
        else
            strMsg = "系统将使用打开的数据，";

        strMsg += "确定要打开吗？"
    }

    jConfirm(strMsg, '请确认', function (rb)
    {
        if (rb)
            ResetData(rtn.anVal, true);

        if (AfterResetData != null)
            AfterResetData(rb);
    });
}


function Show_SumLists()
{
    var divStatsSum = document.getElementById("divMainStatsSum");
    var divStatsSumLists = document.getElementById("divStatsSumLists");

    if (g_queue.nIDX < 0)
    {
        //divStatsSum.style.display = "none"
        divStatsSumLists.innerHTML = "";
        return;
    }

    // calculate large counts:

    var nNumCount = g_bttnStatsSum.Value();
    var nStart = 0;
    if (nNumCount < (g_queue.nIDX + 1))
        nStart = (g_queue.nIDX + 1) - nNumCount;

    var data3C3R = new CStats3C3R();
    data3C3R.Reset();

    for (var n = nStart; n <= g_queue.nIDX; ++n)
        data3C3R.AddNum(g_queue.anNum[n]);

    g_queue.CalcZeroList(nStart);

    // show:

    var strHtml = "";

    var nTotal = g_queue.nIDX + 1 - nStart;

    strHtml = "<table cellpadding='0' cellspacing='0' id='tblStatsSum'>";
    var bFirst = true;

    var fWidth = 0;
    var strTD = " onclick='OnMainSwitchStats(true)'";

    for (var nn = 0; nn < 3; ++nn)
    {
        strHtml += "<tr>";

        var str = "";
        if (nn == 0)
            str = "<td" + strTD + ">组</td>";
        else if (nn == 1)
            str = "<td" + strTD + ">行</td>";
        else
            str = "<td class='tdTotal'" + strTD + ">" + nTotal.toString() + "</td>";

        strHtml += str;
        strHtml += "<td class='tdStatsSumListItem'>";
        strHtml += "<div id='divStatsSumListItem" + nn.toString();
        strHtml += "' class='divStatsSumListItem' onclick='OnStatsSumListClick(" + nn.toString() + ")'>";
        bFirst = true;
        fWidth = 0;

        for (var n = 0; n < data3C3R.anLargeCount[nn].length; ++n)
        {
            if (data3C3R.anLargeCount[nn][n] > 0)
            {
                if (!bFirst)
                {
                    strHtml += ";&nbsp;";
                    fWidth += 1.5;

                    if (fWidth >= 34)
                    {
                        strHtml += "<br>";
                        fWidth = 0;
                    }
                }

                bFirst = false;

                var strNum = (n + 11).toString();
                fWidth += 2;

                if (n == 19)
                {
                    strNum += "及以上";
                    fWidth += 6;
                }
                strHtml += strNum + "(" + data3C3R.anLargeCount[nn][n].toString() + ")";
                fWidth += ((data3C3R.anLargeCount[nn][n] > 9) ? 3 : 2);
            }
        }
        strHtml += "</div></td></tr>";
    }
    strHtml += "<tr><td class='tdZero'" + strTD + ">" + g_queue.nCountNoZero.toString() + "</td>";
    strHtml += "<td class='tdStatsSumListItem'>";
    strHtml += "<div id='divStatsSumListItem3' class='divStatsSumListItem' onclick='OnStatsSumListClick(3)'>";
    bFirst = true;
    var strNum = "";

    fWidth = 0;
    for (var n = g_queue.anZero.length - 1; n >= 0 ; --n)
    {
        if (!bFirst)
        {
            strHtml += ";&nbsp;";
            fWidth += 1.5;

            if (fWidth >= 44)
            {
                strHtml += "<br>";
                fWidth = 0;
            }
        }

        bFirst = false;
        if (g_queue.anZero[n] == 0)
        {
            strNum = "<span class='txtZero'>0</span>";
            fWidth += 1;
        }
        else
        {
            strNum = g_queue.anZero[n].toString();
            fWidth += ((g_queue.anZero[n] > 99) ? 3 : ((g_queue.anZero[n] > 9) ? 2 : 1));
        }

        strHtml += strNum;
    }
    strHtml += "</div></td></tr>"
    strHtml += "</table>";

    divStatsSumLists.innerHTML = strHtml;
    //divStatsSum.style.display = "";
}


function GetStatsNumTdString(statsNum, nIdx, aStr)
{
    var strNumber = nIdx.toString();
    if (nIdx == 0)
        strNumber = "<span class='txtStatsNumZero'>" + strNumber + "</span>";

    if (nIdx != 37)
    {
        aStr[0] = strNumber;
        aStr[1] = statsNum.anDistance[nIdx];
        aStr[2] = statsNum.anFrequence[nIdx];
    }
    else
    {
        aStr[0] = "平均";
        aStr[1] = Math.round(statsNum.anDistance[nIdx] * 100) / 100;
        aStr[2] = Math.round(statsNum.anFrequence[nIdx] * 100) / 100;
    }
}

// 行组 - 明细
function Show_StatsColRowDetail()
{
    var div = document.getElementById("divStatsColRowDetail");
    var astrTitle = ["一组", "二组", "三组", "1行", "2行", "3行"];

    var strHtml = "<table cellspacing='0' cellpadding='0' border='0'>";

    for (var nn = 0; nn < 6; ++nn)
    {
        strHtml += "<tr>";
        strHtml += "<td class='tdSRCTitle";
        strHtml += " SRCMore";
        strHtml += "'>";
        strHtml += astrTitle[nn];
        strHtml += "</td><td class='tdSRC";
        strHtml += " SRCMore";
        strHtml += "'>";

        var nIdx = (nn < 3) ? nn : (nn + 1);

        var nCount = 0;

        var nFirstVal = g_3C3R.data.anValue[nn];
        strHtml += "<span class='" + ((nFirstVal == 0) ? "numFirstZero" : "numFirst") + "'>";
        strHtml += nFirstVal.toString();
        strHtml += "</span>"

        ++nCount;

        var bFirst = true;

        for (var n = g_waves.anDistance[nIdx].length - 1 ; n >= 0; --n)
        {
            var nVal = (g_waves.anDistance[nIdx][n] - 1); // 显示的是距离-1
            /*
            if (bFirst)
            {
                bFirst = false;
                if (nVal == 0)
                    continue;
            }
            */

            strHtml += ", ";
            strHtml += nVal.toString();

            ++nCount;
            if (nCount >= 80) // 最多显示80个数字
                break;
        }
        strHtml += "</td></tr>";
    }

    div.innerHTML = strHtml;
}

// 细化 - Compare
function Show_StatsCRDCompare(nSortCol)
{
    var CRDCompare = new CStatsCRDCompare(nSortCol);

    CRDCompare.Calc(g_waves.anDistance, g_bttnStatsScope.Value(),
        g_bttnStatsCRDRoundStart.Value(), g_bttnStatsCRDRoundBet.Value());

    var divList = document.getElementById("divStatsCRDCompareList");
    var strHtml = "<table cellpadding='0' cellspacing='0' id='tblStatsCRDCompare'>";
    strHtml += "<tr><td onclick='OnStatsCRDCompareClick(0)'>行组</td>";
    strHtml += "<td onclick='OnStatsCRDCompareClick(1)'>成功";
    strHtml += CRDCompare.SortMark(1);
    strHtml += "</td><td>失败</td>";
    strHtml += "<td onclick='OnStatsCRDCompareClick(2)'>失败率";
    strHtml += CRDCompare.SortMark(2);
    strHtml += "</td></tr>";

    for(var n = 0; n < CRDCompare.anCRDCompareData.length; ++ n)
    {
        strHtml += "<tr><td>" + GetColRowLongSpec(CRDCompare.anIdx[n]) + "</td>";
        strHtml += "<td>" + CRDCompare.anCRDCompareData[CRDCompare.anIdx[n]].nSucceeded.toString() + "</td>";
        strHtml += "<td>" + CRDCompare.anCRDCompareData[CRDCompare.anIdx[n]].nFailed.toString() + "</td>";
        strHtml += "<td>" + (CRDCompare.anCRDCompareData[CRDCompare.anIdx[n]].fFailure * 100).toFixed(2).toString() + "%</td>";
        strHtml += "</tr>";
    }

    strHtml += "</table>";

    divList.innerHTML = strHtml;
}

function DrawColRowChart8()
{
    for (var n = 0; n < 8; ++n)
    {
        var strCanvasID = "cvCRC" + n.toString();
        g_waves.DrawColRowChart(strCanvasID, 380, 270, n, 8);
    }
}

// 行组 - 统计图
function Show_StatsColRowChart()
{
    DrawColRowChart8();
}

function GetCRESelectedColRows(anIdx)
{
    var rows = $('#dgStatsCREColRows').datagrid('getSelections');
    for (var n = 0; n < rows.length; ++n)
    {
        anIdx[n] = GetColRowIdx(rows[n].v);
    }
}


function GetCRESelectedRounds(anRound)
{
    var rows = $('#dgStatsCRERounds').datagrid('getSelections');
    for (var n = 0; n < rows.length; ++n)
    {
        anRound[n] = parseInt(rows[n].v);
    }
}


function ShowStatsCREResults()
{
    var anCRIdx = new Array();
    GetCRESelectedColRows(anCRIdx);

    var anRound = new Array();
    GetCRESelectedRounds(anRound);

    var strHtml = "";

    if ((anCRIdx.length > 0) && (anRound.length > 0))
    {
        var CREResult = new CIndexedArray();
        CREResult.Reset(anCRIdx.length);

        g_waves.CalcCRE(anCRIdx, anRound, CREResult);

        for(var n = 0; n < anCRIdx.length; ++n)
        {
            var nValue = CREResult.Value(n);

            var strClass = (nValue > 0) ? "CREWin" : ((nValue == 0) ? "CREDraw" : "CRELose");

            strHtml += "<span class='" + strClass + "'>"
                + GetColRowLongSpec(anCRIdx[CREResult.anIdx[n]]) + "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + CREResult.Value(n).toString()
                + "元</span>";

            if (n < (anCRIdx.length - 1))
                strHtml += "<br>";
        }
    }

    var td = document.getElementById("tdStatsCRE3");
    td.innerHTML = strHtml;
}

function OnDGCREColRowsSelChange(bDG2Ready)
{
    var anIdx = new Array();
    GetCRESelectedColRows(anIdx);

    var strVal = "";
    for (var n = 0; n < anIdx.length; ++n)
    {
        if (n > 0)
            strVal += ",";
        strVal += anIdx[n].toString();
    }
    WriteData(DATA_CRE_COLROW_INDEXES, strVal);

    if(bDG2Ready)
        ShowStatsCREResults();
}

function OnDGCRERoundsSelChange()
{
    var anRound = new Array();
    GetCRESelectedRounds(anRound);

    var strVal = "";
    for (var n = 0; n < anRound.length; ++n)
    {
        if (n > 0)
            strVal += ",";
        strVal += anRound[n].toString();
    }
    WriteData(DATA_CRE_BET_ROUNDS, strVal);

    ShowStatsCREResults();
}

function ShowStatsCREGrids()
{
    var bDG2Ready = false;

    $('#dgStatsCREColRows').datagrid({
        data: g_waves.ColRows,
        singleSelect: false,
        onLoadSuccess: function (data)
        {
            bDG2Ready = false;

            $("#dgStatsCREColRows").parent().find("div .datagrid-header-check").children("input[type=\"checkbox\"]").eq(0).attr("style", "display:none;");
            if (data)
            {
                var strVal = ReadData(DATA_CRE_COLROW_INDEXES, "");
                if (strVal.length > 0)
                {
                    var astrIdx = strVal.split(",");

                    $.each(data.rows, function (index, item)
                    {
                        for (var n = 0; n < astrIdx.length; ++n)
                        {
                            if(GetColRowFullSpec(parseInt(astrIdx[n])) == item.v)
                            {
                                $('#dgStatsCREColRows').datagrid('checkRow', index);
                                break;
                            }
                        }
                    });
                }
            }
        },
        onClickRow: function (nIdxRow)
        {
            OnDGCREColRowsSelChange(bDG2Ready);
        },
        onSelect: function (index, row)
        {
            OnDGCREColRowsSelChange(bDG2Ready);
        },
        onUnselect: function (index, row)
        {
            OnDGCREColRowsSelChange(bDG2Ready);
        },
    });
    $('#dgStatsCRERounds').datagrid({
        data: g_waves.BetRounds,
        singleSelect: false,
        onLoadSuccess: function (data)
        {
            bDG2Ready = true;

            $("#dgStatsCRERounds").parent().find("div .datagrid-header-check").children("input[type=\"checkbox\"]").eq(0).attr("style", "display:none;");
            if (data)
            {
                var strVal = ReadData(DATA_CRE_BET_ROUNDS, "");
                if (strVal.length > 0)
                {
                    var astrIdx = strVal.split(",");

                    $.each(data.rows, function (index, item)
                    {
                        for (var n = 0; n < astrIdx.length; ++n)
                        {
                            if (astrIdx[n] == item.v)
                            {
                                $('#dgStatsCRERounds').datagrid('checkRow', index);
                                break;
                            }
                        }
                    });
                }
            }
        },
        onClickRow: function (nIdxRow)
        {
            OnDGCRERoundsSelChange();
        },
        onSelect: function (index, row)
        {
            OnDGCRERoundsSelChange();
        },
        onUnselect: function (index, row)
        {
            OnDGCRERoundsSelChange();
        },
    });

    ShowStatsCREResults();
}


// 行组 - 统计数据
function Show_StatsColRowSum()
{
    var strHtml = "<table id='tblStatsColRowSum' cellpadding='0' cellspacing='1' style='width: 100%'>";

    strHtml += "<tr><td class='tdStatsCRSColT'>&nbsp;</td>";
    for (var n = 0; n < g_waves.CRC_NUM_COUNT; ++n)
    {
        var strNum = n.toString();
        if (n == (g_waves.CRC_NUM_COUNT - 1))
            strNum = (g_waves.CRC_NUM_COUNT - 2).toString() + "+";
        strHtml += "<td class='tdStatsCRSCol'>" + strNum + "</td>";
    }
    strHtml += "</tr>";

    for (var nCR = 0; nCR < 8; ++nCR)
    {
        strHtml += "<tr><td>" + GetColRowFullSpec(nCR) + "</td>";

        for (var n = 0; n < g_waves.CRC_NUM_COUNT; ++n)
        {
            strHtml += "<td>" + g_waves.anCRCSum[nCR][n].toString() + "</td>";
        }
        strHtml += "</tr>";
    }
    strHtml += "</table>";

    var div = document.getElementById("divStatsCRSTable");
    div.innerHTML = strHtml;

    ShowStatsCREGrids();
    ShowStatsCREResults();
}

// 细化
function Show_StatsColRowDig()
{
    Show_StatsCRDCompare(-1);
}

// 号码统计数据：
function Show_StatsNumbers(nSortCol)
{
    var nScope = g_bttnStatsScope.Value();

    var stats = new CStatsNumbers(nSortCol);
    stats.Calc(g_queue, nScope, 0);

    var strHtml = "<table cellpadding='0' cellspacing='1' border='0' style='width: 100%' id='tblStatsNumbers'>";

    strHtml += "<tr>"
    for (var n = 0; n < 2; ++n)
    {
        strHtml += "<td ";

        if (n == 1)
            strHtml += "class='tdStatsNumSecond' ";

        strHtml += "onclick='OnStatsNumClick(0)'>号码</td>";
        strHtml += "<td onclick='OnStatsNumClick(1)'>距离";
        strHtml += stats.SortMark(1);
        strHtml += "</td><td onclick='OnStatsNumClick(2)'>次数";
        strHtml += stats.SortMark(2);
        strHtml += "</td>";
    }
    strHtml += "</tr>"

    var aStr = [];

    for (var n = 0; n <= 18; ++n)
    {
        var nIdx = stats.anIdx[n];
        var nIdxNextCol = stats.anIdx[n + 19];

        GetStatsNumTdString(stats, nIdx, aStr);

        strHtml += "<tr><td class='tdStatsNumber'>" + aStr[0] + "</td>";
        strHtml += "<td>" + aStr[1] + "</td>";
        strHtml += "<td>" + aStr[2] + "</td>";

        GetStatsNumTdString(stats, nIdxNextCol, aStr);

        strHtml += "<td class='tdStatsNumber tdStatsNumSecond'>" + aStr[0] + "</td>";
        strHtml += "<td>" + aStr[1] + "</td>";
        strHtml += "<td>" + aStr[2] + "</td></tr>";
    }

    strHtml += "</table>";

    var div = document.getElementById("divStatsOtherNumbersContents");
    div.innerHTML = strHtml;

    var maxdistances = new CNumberMaxDistances();
    maxdistances.Calc(g_queue, nScope, 0);

    strHtml = "";
    var bFirst = true;
    for(var n = 0; n < 5; ++ n)
    {
        if(maxdistances.anMaxNum[n] < 0)
            break;

        if (!bFirst)
            strHtml += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";

        var strClass = "tdStatsNumber";
        if (maxdistances.anMaxNum[n] == 0)
            strClass = "txtStatsNumZero";

        strHtml += "<span class='" + strClass + "'>" + maxdistances.anMaxNum[n].toString() + "</span>&nbsp;:&nbsp;";
        strHtml += maxdistances.anMax[n].toString();
        bFirst = false;
    }

    div = document.getElementById("divMaxDistanceTops");
    div.innerHTML = strHtml;
}

// 打法
// nSortCol - sort column, 0: name, 1: win, 2: realtime, -1: no change
// bMain    - whether stats on main page (there is a game stats list on main page, also 
//                                     there is a specific game stats page)
function Show_StatsGames(nSortCol, bMain)
{
    var strCtrlID = "";
    var strTD = "";
    var strIsMain = "";
    var strAppendHeight = "";

    if (bMain)
    {
        strCtrlID = "MainStatsGames";
        strTD = " onclick='OnMainSwitchStats(false)'"
        strIsMain = "true";
        strAppendHeight = "650";
    }
    else
    {
        strCtrlID = "StatsGames";
        strIsMain = "false";
        strAppendHeight = "220";
    }

    var divGames = document.getElementById("div" + strCtrlID);
    if (g_queue.nIDX < 0)
    {
        divGames.innerHTML = "";
        return;
    }

    var nScope = g_bttnStatsScope.Value();

    var games = new CStatsGames(nSortCol);
    games.Calc(g_queue, nScope, 0);

    var strHtml = "<table cellpadding='0' cellspacing='0' id='tbl" + strCtrlID + "'>";
    strHtml += "<tr><td onclick='OnStatsGamesClick(0)'>名称</td><td>完成</td>";
    strHtml += "<td onclick='OnStatsGamesClick(1)'>赢";
    strHtml += games.SortMark(1);
    strHtml += "</td><td>平</td><td>输</td>";
    strHtml += "<td onclick='OnStatsGamesClick(2)'>结算";
    strHtml += games.SortMark(2);
    strHtml += "</td><td>实时</td></tr>";
    for (var nn = 0; nn < games.aGame.length; ++nn)
    {
        strHtml += "<tr><td" + strTD + ">";
        strHtml += games.aGame[games.anIdx[nn]].strName;
        strHtml += "</td><td>"
        strHtml += games.aGame[games.anIdx[nn]].nCountCompleted.toString();
        strHtml += "</td><td class='tdWon'>"
        strHtml += games.aGame[games.anIdx[nn]].nCountWon.toString();
        strHtml += "</td><td class='tdDrew'>"
        strHtml += games.aGame[games.anIdx[nn]].nCountDrew.toString();
        strHtml += "</td><td class='tdLost'>"
        strHtml += games.aGame[games.anIdx[nn]].nCountLost.toString();
        strHtml += "</td><td>"
        strHtml += games.aGame[games.anIdx[nn]].nBalance.toString();
        strHtml += "</td><td>"
        strHtml += games.aGame[games.anIdx[nn]].nMoney.toString();
        strHtml += "</td></tr>";
    }
    strHtml += "</table><div style=\"height: "+ strAppendHeight + "px\">&nbsp;</div>";
    divGames.innerHTML = strHtml;
}

// 频率 - 多行组单区域
function Show_StatsFrequencies()
{
    var nCR = g_waves.nFrequnceyCR;
    if (nCR >= 0)
        return;

    var nLen = g_waves.afFrequencies[0][g_bttnStatsFrequencyScope.nSelIdx].length;


    var nMax = 180; // 最多显示180轮

    var canvas = document.getElementById("cvFrequencies");
    canvas.width = 935;
    canvas.height = 1600;

    var context = canvas.getContext('2d');

    context.clearRect(0, 0, canvas.width, canvas.height);

    var nIdx0 = 0;
    if (nLen > nMax)
        nIdx0 = nLen - nMax;

    var nHeight100 = canvas.height / 20;
    var nHeight50 = nHeight100 / 2;
    var nY0 = 20;

    var anBase = new Array(8);
    for (var nn = 0; nn < 8; ++nn)
        anBase[nn] = nY0 + nHeight100 * (2 * nn + 1);

    if (nLen > 0)
    {
        var n1 = g_bttnStatsFrequencyScope.nSelIdx;

        for (var nn = 0; nn < 8; ++nn)
        {
            for (var n = nIdx0; n < nLen; ++n)
            {
                context.beginPath();

                context.lineWidth = 5;

                if ((nn % 4) == 3)
                {
                    context.strokeStyle = "#999999";
                }
                else
                {
                    if (g_waves.afFrequencies[nn][n1][n] >= 0)
                        context.strokeStyle = "#a9cf99";
                    else
                        context.strokeStyle = "#eeaf9f";
                }

                var i = n - nIdx0;
                if (nLen < nMax)
                    i = i + (nMax - nLen);

                context.moveTo(20 + i * 5, anBase[nn]);
                context.lineTo(20 + i * 5, anBase[nn] - (g_waves.afFrequencies[nn][n1][n] * nHeight100 / 100));

                context.closePath();
                context.stroke();
            }
        }
    }

    context.strokeStyle = "#8f8f8f";
    context.lineWidth = 1;
    context.beginPath();
    for(var n = 0; n < 32; ++ n)
    {
        context.moveTo(18, nY0 + nHeight50 * n);
        context.lineTo(917, nY0 + nHeight50 * n);
    }
    context.closePath();
    context.stroke();

    context.strokeStyle = "#afafaf";
    context.lineWidth = 1;
    context.beginPath();
    for (var n = 0; n <= 10; ++n)
    {
        context.moveTo(18 + 90 * n, nY0);
        context.lineTo(18 + 90 * n, nY0 + nHeight50 * 31);
    }
    context.closePath();
    context.stroke();

    context.font = "30px 微软雅黑";

    for (var nn = 0; nn < 8; ++nn)
    {
        var strText = "";
        if (nn == 0) strText = "一组";
        else if (nn == 1) strText = "二组";
        else if (nn == 2) strText = "三组";
        else if (nn == 3) strText = "组";
        else if (nn == 4) strText = "1行";
        else if (nn == 5) strText = "2行";
        else if (nn == 6) strText = "3行";
        else if (nn == 7) strText = "行";

        context.fillText(strText, 25, anBase[nn] - nHeight50 - 5);
    }
}

// 频率 - 单行组多区域
function Show_StatsFrequenciesDetail()
{
    var nCR = g_waves.nFrequnceyCR;
    if (nCR < 0)
        return;

    var nScopeCount = g_anFrequencyScope.length;

    var nMax = 180; // 最多显示180轮

    var canvas = document.getElementById("cvFrequenciesDetail");
    canvas.width = 935;
    canvas.height = 1500;

    var context = canvas.getContext('2d');

    context.clearRect(0, 0, canvas.width, canvas.height);

    var nHeight100 = canvas.height / 16;
    var nHeight50 = nHeight100 / 2;
    var anBase = new Array(nScopeCount);

    var nY0 = 30;

    for (var nn = 0; nn < nScopeCount; ++nn)
        anBase[nn] = nY0 + nHeight100 * (2 * nn + 1);

    for (var nn = 0; nn < nScopeCount; ++nn)
    {
        var nLen = g_waves.afFrequencies[0][nn].length;
        if (nLen <= 0)
            continue;

        var nIdx0 = 0;
        if (nLen > nMax)
            nIdx0 = nLen - nMax;

        for (var n = nIdx0; n < nLen; ++n)
        {
            context.beginPath();

            context.lineWidth = 5;

            if (g_waves.afFrequencies[nCR][nn][n] >= 0)
                context.strokeStyle = "#a9cf99";
            else
                context.strokeStyle = "#eeaf9f";

            var i = n - nIdx0;
            if (nLen < nMax)
                i = i + (nMax - nLen);

            context.moveTo(20 + i * 5, anBase[nn]);
            context.lineTo(20 + i * 5, anBase[nn] - (g_waves.afFrequencies[nCR][nn][n] * nHeight100 / 100));

            context.closePath();
            context.stroke();
        }
    }

    context.strokeStyle = "#8f8f8f";
    context.lineWidth = 1;
    context.beginPath();
    for (var n = 0; n <= 4 * nScopeCount; ++n)
    {
        context.moveTo(18, nY0 + nHeight50 * n);
        context.lineTo(917, nY0 + nHeight50 * n);
    }
    context.closePath();
    context.stroke();

    context.strokeStyle = "#afafaf";
    context.lineWidth = 1;
    context.beginPath();
    for (var n = 0; n <= 10; ++n)
    {
        context.moveTo(18 + 90 * n, nY0);
        context.lineTo(18 + 90 * n, nY0 + nHeight50 * 4 * nScopeCount);
    }
    context.closePath();
    context.stroke();

    context.font = "30px 微软雅黑";

    for (var nn = 0; nn < nScopeCount; ++nn)
    {
        context.fillText(g_anFrequencyScope[nn].toString(), 25, anBase[nn] - nHeight50 - 5);
    }
}

function DrawDistances8()
{
    for (var n = 0; n < 8; ++n)
    {
        var strCanvasID = "cvDist" + n.toString();
        g_waves.DrawDistance(strCanvasID, 1080, 170, n, 8);
    }
}

function DrawDistances4(nCROpt)
{
    for (var n = 0; n < 4; ++n)
    {
        var strCanvasID = "cvDist1" + n.toString();
        g_waves.DrawDistance(strCanvasID, 1080, 300, (nCROpt * 4 + n), 4);
    }
}

function DrawDistance1(ncr)
{
    var nCR = g_status.StatsDistCROpt * 4 + ncr;
    g_waves.DrawDistance("cvDist", 1080, 1000, nCR, 1);
}


function Show_StatsDistances()
{
    DrawDistances8();
    DrawDistances4(g_status.StatsDistCROpt);
    DrawDistance1(g_status.StatsDistCR);
}

// 其他 - 轮次统计数据
function Show_StatsRounds()
{
    var MAX_COUNT = 20;

    var nTotal = 0;

    var anCount = [];
    var anCountAfter = [];
    var anCountBefore = [];
    var anCountMaxAfter = [];

    for (var nn = 0; nn < 3; ++nn)
    {
        anCount[nn] = [];
        anCountAfter[nn] = [];
        anCountBefore[nn] = [];
        anCountMaxAfter[nn] = 0;
    }

    var an3C3RPrevIdx = [];

    for (var nn = 0; nn < 6; ++nn)
        an3C3RPrevIdx[nn] = -1;

    for (var nn = 0; nn < 3; ++nn)
        for (var n = 0; n < MAX_COUNT; ++n)
            anCount[nn][n] = 0;

    var nScope = g_bttnStatsScope.Value();
    var nStart = g_queue.nIDX - nScope + 1;
    if (nStart < 0) nStart = 0;

    for (var n = nStart; n <= g_queue.nIDX; ++n)
    {
        if (g_queue.anNum[n] == 0)
            continue;

        nTotal++;

        var nCol = GetNumCol(g_queue.anNum[n]);
        var nRow = GetNumRow(g_queue.anNum[n]);

        var nGap = n - an3C3RPrevIdx[nCol] - 1;
        if (nGap < MAX_COUNT)
        {
            anCount[0][nGap]++;
            anCount[2][nGap]++;
        }
        else
        {
            anCountMaxAfter[0]++;
            anCountMaxAfter[2]++;
        }
        an3C3RPrevIdx[nCol] = n;

        nGap = n - an3C3RPrevIdx[nRow + 3] - 1;
        if (nGap < MAX_COUNT)
        {
            anCount[1][nGap]++;
            anCount[2][nGap]++;
        }
        else
        {
            anCountMaxAfter[1]++;
            anCountMaxAfter[2]++;
        }
        an3C3RPrevIdx[nRow + 3] = n;
    }

    for (var nn = 0; nn < 3; ++nn)
    {
        anCountAfter[nn][MAX_COUNT - 1] = anCountMaxAfter[nn];

        for (var n = MAX_COUNT - 2; n >= 0; --n)
            anCountAfter[nn][n] = anCount[nn][n + 1] + anCountAfter[nn][n + 1];

        anCountBefore[nn][0] = 0;

        for (var n = 1; n < MAX_COUNT; ++n)
            anCountBefore[nn][n] = anCount[nn][n - 1] + anCountBefore[nn][n - 1];
    }

    var strHtml = "<table cellpadding='0' cellspacing='0' id='tblStatsRoundSum'>";

    strHtml += "<tr id='trSRSTitle1'><td></td>";
    strHtml += "<td colspan='3' class='tdSRSColumn'>组</td>";
    strHtml += "<td colspan='3' class='tdSRSColumn'>行</td>";
    strHtml += "<td colspan='3'>全部</td>";
    strHtml += "</tr>";

    strHtml += "<tr id='trSRSTitle2'><td>轮次</td>";
    for (var nn = 0; nn < 3; ++nn)
        strHtml += "<td>前</td><td>本轮</td><td class='tdSRSColumn'>后</td>";
    strHtml += "</tr>";

    for (var n = 0; n < MAX_COUNT; ++n)
    {
        strHtml += "<tr>";
        strHtml += "<td class='tdSFTitle'>" + (n + 1).toString() + "</td>";
        for (var nn = 0; nn < 3; ++nn)
        {
            strHtml += "<td>" + anCountBefore[nn][n].toString() + "</td>";
            strHtml += "<td>" + anCount[nn][n].toString() + "</td>";
            strHtml += "<td class='tdSRSColumn'>" + anCountAfter[nn][n].toString() + "</td>";
        }
        strHtml += "</tr>";
    }
    strHtml += "</table>";

    var div = document.getElementById("divStatsRoundSum");
    div.innerHTML = strHtml;
}

// 其他 - 轮次参考数据
function Show_StatsRoundBet()
{
    var strHtml = "";

    var nScope = g_bttnStatsScope.Value();
    var nBefore = 0;

    var data3C3R = new CStats3C3R();
    data3C3R.Reset();

    var nMaxIdx = g_queue.nIDX - nBefore;
    var nMinIdx = g_queue.nIDX - nBefore - nScope + 1;

    if (nMaxIdx >= 0)
    {
        var stats = new CStatsRoundBet();

        if (nMinIdx < 0)
            nMinIdx = 0;

        for (n = nMinIdx; n <= nMaxIdx; ++n)
        {
            data3C3R.AddNum(g_queue.anNum[n]);
            stats.AddNum(g_queue.anNum[n], data3C3R);
        }

        strHtml = "<table cellpadding='0' cellspacing='0' id='tblStatsRoundBet'>";
        strHtml += "<tr><td>轮次</td><td>不出</td><td>概率</td>";
        for (var nn = 0; nn < stats.anFailedRound.length; ++nn)
        {
            strHtml += "<td>F" + stats.anFailedRound[nn].toString() + "</td><td>概率</td>";
        }
        strHtml += "</tr>";

        var nTotal = nMaxIdx - nMinIdx + 1;

        for (var n = 0; n < stats.anRound.length; ++n)
        {
            strHtml += "<tr id='trStatsIntv" + n.toString() + "' onclick='OnStatsIntervalClick(true)'><td>" + stats.anRound[n].toString() + "</td>";
            strHtml += "<td>" + stats.anNotYetCount[n].toString() + "</td>";

            var percent1 = stats.anNotYetCount[n] * 100 / nTotal;
            strHtml += "<td>" + percent1.toFixed(1) + "%</td>";


            for (var nn = 0; nn < stats.anFailedRound.length; ++nn)
            {
                strHtml += "<td>" + stats.anFailed[nn][n].toString() + "</td>";

                var percent2 = 0;
                if (stats.anNotYetCount[n] > 0)
                    percent2 = stats.anFailed[nn][n] * 100 / stats.anNotYetCount[n];
                strHtml += "<td>" + percent2.toFixed(1) + "%</td>";
            }

            strHtml += "</tr>";
        }
        strHtml += "</table>";
    }

    var div = document.getElementById("divStatsRoundBetC");
    div.innerHTML = strHtml;
}

// 追打:
function Show_StatsLongs()
{
    var nBetCount = g_bttnStatsLongsBet.Value();
    var nRound = g_bttnStatsLongs.Value();

    var data3C3R = new CStats3C3R();
    data3C3R.Reset();

    var nTotalCount = 0;
    var anOccurCount = [0, 0, 0, 0, 0, 0, 0];
    var nNotOccurCount = 0;

    var aLongs = [];
    for (var nn = 0; nn < 6; ++nn)
        aLongs[nn] = new CStatsLongItem();

    for (var n = 0; n <= g_queue.nIDX; ++n)
    {
        var num = g_queue.anNum[n];

        if (num == 0)
            continue;

        var nCol = GetNumCol(num);
        var nRow = GetNumRow(num);

        for(var nn = 0; nn < 6; ++ nn)
        {
            if (aLongs[nn].bActive)
            {
                if ((nn == nCol) || (nn == (nRow + 3)))
                {
                    anOccurCount[aLongs[nn].nRoundAfter]++
                    aLongs[nn].Reset();
                }
                else
                {
                    aLongs[nn].nRoundAfter++;

                    if (aLongs[nn].nRoundAfter >= nBetCount)
                    {
                        nNotOccurCount++;
                        aLongs[nn].Reset();
                    }
                }
            }
            else
            {
                if (data3C3R.data.anValue[nn] >= nRound)
                {
                    if ((nn == nCol) || (nn == (nRow + 3)))
                    {
                        aLongs[nn].nRoundBefore = data3C3R.data.anValue[nn]; // not used currently
                        aLongs[nn].bActive = true;
                        ++nTotalCount;
                    }
                }
            }
        }

        data3C3R.AddNum(num);
    }

    var strHtml = "<table cellpadding='0' cellspacing='0' style='width: 100%' id='tblStatsLongs'>";

    strHtml += "<tr><td>次数</td>";
    for (var n = 0; n < nBetCount; ++n)
        strHtml += "<td>" + (n + 1).toString() + "</td>";
    strHtml += "<td>NOT</td></tr>";

    strHtml += "<tr><td id='tdSLT' rowspan='2'>" + nTotalCount.toString() + "</td>";
    for (var n = 0; n < nBetCount; ++n)
        strHtml += "<td>" + anOccurCount[n].toString() + "</td>";
    strHtml += "<td>" + nNotOccurCount.toString() + "</td></tr>";

    strHtml += "<tr>";

    var strPercent;

    for (var n = 0; n < nBetCount; ++n)
    {
        if (nTotalCount > 0)
            strPercent = (anOccurCount[n] * 100 / nTotalCount).toFixed(1).toString();
        else
            strPercent = "0";

        strHtml += "<td>" + strPercent + "%</td>";
    }

    if (nTotalCount > 0)
        strPercent = (nNotOccurCount * 100 / nTotalCount).toFixed(1).toString();
    else
        strPercent = "0";

    strHtml += "<td>" + strPercent + "%</td></tr>";

    strHtml += "</table>";

    var div = document.getElementById("divStatsOtherLongsContents");
    div.innerHTML = strHtml;
}

function SetFilesTitle(strTitle)
{
    var td = document.getElementById("tdFilesTitle");
    td.innerHTML = strTitle;
}

function UpdateFilesButtonStatus(nSelCount)
{
    var astrIDBttn = ["tdBttnFileOpen", "tdBttnFileRename", "tdBttnFileDelete", "tdBttnFileImport", "tdBttnFileExport", "tdBttnTools"];
    var abEnabled = [true, true, true, true, true, true];

    if (nSelCount == 0)
    {
        abEnabled[0] = false;
        abEnabled[1] = false;
        abEnabled[2] = false;
    }
    else if (nSelCount > 1)
    {
        abEnabled[0] = false;
        abEnabled[1] = false;
        abEnabled[2] = true;
    }

    abEnabled[4] = (g_files.fs.rows.length > 0);

    for (var n = 0; n < astrIDBttn.length; ++n)
    {
        var bttn = document.getElementById(astrIDBttn[n]);
        bttn.className = abEnabled[n] ? "tdSBEnabled" : "tdSBDisabled";
    }
}

function UpdateConfigManageButtonStatus()
{
    $(function ()
    {
        var rows = $('#dgBetsManage').datagrid('getSelections');
        var bttn = document.getElementById("tdBttnBetsManageDel");
        bttn.className = "bttnDialog " +
            (((rows.length < 1) || (rows.length >= g_gamebets.bets.rows.length)) ?
            "tdSBDisabled" : "tdSBEnabled");
    });
}


function OpenFilesDialog()
{
    SetFilesTitle("保存的数据");
    SwitchWindow("divMain", "divFiles");

    var div = document.getElementById("divFilesTop");
    var n1 = div.offsetHeight;
    div = document.getElementById("divFilesBottom");
    var n2 = div.offsetTop;

    div = document.getElementById("divFilesMain");
    div.style.top = n1 + 1;
    div.style.height = n2 - n1 - 1;

    g_files.Load();

    UpdateFilesButtonStatus(0);

    $(function ()
    {
        $('#dgFiles').datagrid({
            data: g_files.fs,
            singleSelect: false,
            remoteSort: false,
            sortName: 'n',
            sortOrder: 'desc',
            onClickRow: function (nIdxRow)
            {
                var rows = $('#dgFiles').datagrid('getSelections');
                UpdateFilesButtonStatus(rows.length);
            }
        });
    });
}

function SwitchWindow(strHideDivID, strShowDivID)
{
    var div = document.getElementById(strHideDivID);
    div.style.display = "none";

    div = document.getElementById(strShowDivID);
    div.style.display = "";
}


function OnImportOK()
{
    var div = document.getElementById("divImport");
    div.style.display = "none";
}

function OnHideFiles()
{
    SwitchWindow("divFiles", "divMain");
}

function OnTools()
{
    var div = document.getElementById("divTools");
    div.style.display = "";
}

function OnToolsTrim()
{
    var txt1 = document.getElementById("txtTools");
    txt1.focus();
    var r = txt1.createTextRange();
    r.moveStart('character', 1);
    r.collapse();
    r.select();
    return;

    var txt = document.getElementById("txtTools");
    var strText = txt.value;

    var bKeepBR = $("#chkBR").checkbox("options").checked;

    var strTxt = $.trim(strText);
    if(bKeepBR)
        strTxt = strTxt.replace(/[\r\n]+/g, "\r\n");
    else
        strTxt = strTxt.replace(/[\r\n]+/g, ",");

    strTxt = strTxt.replace(/[4]/g, "4,");
    strTxt = strTxt.replace(/[5]/g, "5,");
    strTxt = strTxt.replace(/[6]/g, "6,");
    strTxt = strTxt.replace(/[7]/g, "7,");
    strTxt = strTxt.replace(/[8]/g, "8,");
    strTxt = strTxt.replace(/[9]/g, "9,");
    strTxt = strTxt.replace(/[0]/g, "0,");
    strTxt = strTxt.replace(/[ ]/g, ",");
    strTxt = strTxt.replace(/[，]/g, ",");
    strTxt = strTxt.replace(/[；]/g, ",");
    strTxt = strTxt.replace(/[;]/g, ",");
    strTxt = strTxt.replace(/[、]/g, ",");
    strTxt = strTxt.replace(/[,]+/g, ",");
    strTxt = strTxt.replace(/^,/g, "");
    strTxt = strTxt.replace(/,$/g, "");

    txt.value = strTxt;
}

function OnToolsRevert()
{
    OnToolsTrim();

    var txt = document.getElementById("txtTools");
    var strText = txt.value;
    var astrTxt = strText.split(",");

    var strTxt = "";
    var nLen = astrTxt.length;
    if (nLen > 0)
    {
        for(var n = nLen - 1; n >= 0; --n)
        {
            strTxt += astrTxt[n];
            if (n != 0)
                strTxt += ",";
        }
    }

    txt.value = strTxt;
}

function OnToolsCopy()
{
    var txt = document.getElementById("txtTools");
    var strText = txt.value;
    var clipboard = new ClipboardJS('#tdBttnToolsCopy');
    $("#tdBttnToolsCopy").attr("data-clipboard-action", "copy");
    $("#tdBttnToolsCopy").attr("data-clipboard-text", strText);

    clipboard.on('success', function (e)
    {
        jAlert("已复制到粘贴板", "整理数据文本");
    });

}

function OnToolsExit()
{
    var div = document.getElementById("divTools");
    div.style.display = "none";
}

function FormatTimeCol(value, row, index)
{
    var tm = new Date(value);
    return tm.format("yyyy-MM-dd HH:mm");
}

function FormatBetCol(value, row, index)
{
    return GetArrayDataString(value);
}

function FormatRndCol(value, row, index)
{
    return value.toString();
}

function AfterSaveFile(strFileName, rn)
{
    var rb = true;
    var strMsg = "";
    var strTitle = "";
    if (rn > 0)
    {
        strTitle = "保存成功";
        strMsg = "保存\"" + strFileName + "\"成功";
    }
    else
    {
        strTitle = "保存失败";
        strMsg = g_files.ErrorMessage(rn);
        rb = false;
    }
    jAlert(strMsg, strTitle);

    return rb;
}


function AfterSaveBet(rn)
{
    var rb = true;

    if(rn <= 0)
    {
        var strMsg = g_gamebets.ErrorMessage(rn);
        jAlert(strMsg, "添加失败");
        rb = false;
    }

    return rb;
}

function AfterImportData(rb)
{
    if (rb)
    {
        SaveNumbers();
        OnImportOK();
    }
}


function AfterOpenData(rb)
{
    if (rb)
    {
        SaveNumbers();
        OnHideFiles();
    }
}

function Show_ViewNum()
{
    if (g_queue.nIDX < 0)
        return;

    var nLine = g_queue.nIDX / 10 + 1;
    var nIdx = g_queue.nIDX;

    var strHtml = "<table cellpadding='0' cellspacing='20' border='0' style='width: 100%' id='tblViewNum'>";
    for (var nn = 0; nn < nLine; ++nn)
    {
        strHtml += "<tr>";
        for (var n = 0; n < 10; ++n)
        {
            strHtml += "<td class='";
            if (nIdx >= 0)
            {
                var num = g_queue.anNum[nIdx];

                if (num == 0)
                {
                    strHtml += "tdZero'>0";
                }
                else
                {
                    var nCR = g_bttnViewNum.Value();
                    var nNumRC = 0;
                    if (nCR < 3)
                        nNumRC = GetNumCol(num);
                    else
                        nNumRC = GetNumRow(num) + 3;

                    strHtml += ((nNumRC == nCR) ? "tdHighlight" : "tdNormal") + "'>";

                    strHtml += num.toString();
                }
            }
            else
            {
                strHtml += "tdEmpty'>&nbsp;";
            }
            strHtml += "</td>";

            --nIdx;
        }

        strHtml += "</tr>";
    }
    strHtml += "</table>"

    var div = document.getElementById("divViewNumC");
    div.innerHTML = strHtml;
}

