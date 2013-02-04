/*
* PII reuse/storage checker.
*/

var myID = -1;
var is_appu_active = false;
var last_user_interaction = undefined;
var am_i_logged_in = false;
var pwd_pending_warn_timeout = undefined;

function close_report_ready_modal_dialog() {
    $('#appu-report-ready').dialog("close");
}

function send_report_this_time() {
    var message = {};
    message.type = "report_user_approved";
    //'1' for current report
    message.report_number = 1;
    chrome.extension.sendMessage("", message);
    var message = {};
    message.type = "close_report_reminder";
    chrome.extension.sendMessage("", message);
}

function review_report_this_time() {
    var message = {};
    message.type = "review_and_send_report";
    chrome.extension.sendMessage("", message);
}

function report_reminder_later() {
    var message = {};
    message.type = "remind_report_later";
    chrome.extension.sendMessage("", message);
}

function close_report_reminder_message() {
    var message = {};
    message.type = "close_report_reminder";
    chrome.extension.sendMessage("", message);
}

function show_report_ready_modal_dialog() {
    if ( typeof show_report_ready_modal_dialog.body_wrapped === 'undefined' ) {
	show_report_ready_modal_dialog.body_wrapped = false;
    }
    if ( typeof show_report_ready_modal_dialog.report_ready_dialog_box === 'undefined' ) {
	show_report_ready_modal_dialog.report_ready_dialog_box = null;
    }

    if (!show_report_ready_modal_dialog.body_wrapped) {
	show_report_ready_modal_dialog.body_wrapped = true;
	var report_message = "Appu would like to send anonymous report to its server. \
This report will indicate personal information reusage across sites. \
It will <b>NOT</b> send the actual information. <br/><br/> \
This step is <b>IMPORTANT</b> to find out how can you improve your online behavior<br/> \
You can delete entries from the report by reviewing it before sending it out";

	var report_dialog_msg = sprintf('<div id="appu-report-ready" class="appuwarning" title="Appu: Notification"> %s </div>', report_message);
	var report_dialog_element = $(report_dialog_msg);
	$("#appu-report-ready").remove();
	$('body').append(report_dialog_element);


	//In all popup notification cases, I am stopping further event propagation as we do not want
	//any side-effects on the native web application.
	show_report_ready_modal_dialog.report_ready_dialog_box = $('#appu-report-ready').dialog({ 
	    modal : true, 
	    zIndex: 200,
	    autoOpen : false,
	    draggable : false,
	    resizable : false,
	    position : [ window.innerWidth/2, window.innerHeight/2 ],
	    open : function (event, ui) {
		$('#appu-report-ready')
		    .dialog("option", "position", [
			window.innerWidth/2 - $('#appu-report-ready').width()/2, 
			window.innerHeight/2 - $('#appu-report-ready').height()
		    ]);
	    },
	    width: 550,
	    buttons : [
		{
		    text: "Send Report",
		    click: function(event) { 
			send_report_this_time();
			$(this).dialog("close"); 
			event.stopPropagation();
		    }
		},
		{
		    text: "Review & Send Report",
		    click: function(event) { 
			review_report_this_time();
			$(this).dialog("close");
			event.stopPropagation(); 
		    }
		},
		{
		    text: "Remind me in 30 minutes",
		    click: function(event) { 
			report_reminder_later();
			$(this).dialog("close");
			event.stopPropagation(); 
		    }
		}
	    ]});

	//This wrapping has to be done *ONLY* for dialog boxes. 
	//This is according to comment from their developer blog: 
	//http://filamentgroup.com/lab/using_multiple_jquery_ui_themes_on_a_single_page/#commentNumber4
	show_report_ready_modal_dialog.report_ready_dialog_box.parents('.ui-dialog:eq(0)')
	    .wrap('<div class="appuwarning appu-reporting-box"></div>');
	$('.appu-reporting-box .ui-dialog-titlebar-close')
	    .on("click", function() {close_report_reminder_message();});
    }

    var is_passwd_dialog_open = $('#appu-password-warning').dialog("isOpen");
    //console.log(sprintf("Appu: [%s]: Here here: Time for Report Ready Notifiction", new Date()));

    if (is_passwd_dialog_open != true) {
	$('#appu-report-ready').dialog("open");
	$('.ui-dialog :button').blur();
    }
}

function get_password_initialized_readable(pwd_init_time) {
    var pwd_init_date = new Date(pwd_init_time);
    var curr_date = new Date();
    var msg = "";

    var diff = curr_date - pwd_init_date;

    if (diff <= (24 * 60 * 60 * 1000)) {
	return "1 day";
    }

    var total_seconds = Math.floor(diff / 1000);
    var years = Math.floor(total_seconds / 31536000);
    var days = Math.floor((total_seconds % 31536000) / 86400);
    if (years != 0) {
	msg = years + " yr";
	msg += ((years > 1) ? "s" : "");
    }
    if (days != 0) {
	msg += (msg == "" ? (days + " day") : (", " + days + " day")); 
	msg += ((days > 1) ? "s" : "");
    }
    return msg;
}

function is_passwd_reused(response) {
    if (response.is_password_reused == "yes") {
	//console.log("Appu: Password is reused");
	var alrt_msg = "<b style='font-size:16px'>Password Warning</b> <br/>" +
	    "Estimated Password Cracking Time: <b>" + response.pwd_strength.crack_time_display + "</b><br/>" +
	    "Password not changed for: <b>" + get_password_initialized_readable(response.initialized) + "</b>";
	
	alrt_msg += "<br/><br/><b style='font-size:16px'> Reused In:</b><br/>";
	for (var i = 0; i < response.sites.length; i++) {
	    alrt_msg += response.sites[i] + "<br/>";
	}

	if(response.dontbugme == "no") {
	    var dialog_msg = sprintf('<div id="appu-password-warning" class="appuwarning" title="Appu: Notification"><p>%s</p></div>', alrt_msg);
	    var dialog_element = $(dialog_msg);
	    $("#appu-password-warning").remove();
	    $('body').append(dialog_element);

	    //This wrapping has to be done *ONLY* for dialog boxes. 
	    //This is according to comment from their developer blog: 
	    //http://filamentgroup.com/lab/using_multiple_jquery_ui_themes_on_a_single_page/#commentNumber4
	    $('#appu-password-warning').dialog({ 
		modal : true, 
		zIndex: 200,
		width: 450,
		//autoOpen : false,
		height: 250,
		maxHeight: 500,
		draggable : false,
		resizable : false,
		buttons : [
		    {
			text: "Close",
			click: function(event) { 
			    event.stopPropagation();
			    $(this).dialog("close"); 
			    var message = {};
			    message.type = "clear_pending_warnings";
			    chrome.extension.sendMessage("", message);
			}
		    },
		    {
			text: "Don't bother me about this page further",
			click: function(event) { 
			    event.stopPropagation();
			    var message = {};
			    message.type = "add_to_dontbug_list";
			    message.domain = document.domain;
			    chrome.extension.sendMessage("", message);
			    
			    var message = {};
			    message.type = "clear_pending_warnings";
			    chrome.extension.sendMessage("", message);
			    
			    $(this).dialog("close"); 
			}
		    }
		]  }).parents('.ui-dialog:eq(0)').wrap('<div class="appuwarning"></div>');;
	    
	    // $('#appu-password-warning').dialog("open");
	    $('.appuwarning .ui-dialog-titlebar-close')
		.on("click", function() {
		    var message = {};
		    message.type = "clear_pending_warnings";
		    chrome.extension.sendMessage("", message);
		});

	    //$('.appuwarning .ui-dialog-titlebar').css("background-color", "DarkGreen");
	}
	else {
	    console.log("Appu: Not popping warning alert since the site is in \"don'tbug me list\"");
	}
	//window.setTimeout(function() { alert(alrt_msg); } , 1);
	console.log(alrt_msg);
    }
}

function check_passwd_reuse(jevent) {
    if ( jevent.target.value != "" ) {
	var message = {};
	message.type = "check_passwd_reuse";
	message.domain = document.domain;
	message.passwd = jevent.target.value;
	message.warn_later = false;
	chrome.extension.sendMessage("", message, is_passwd_reused);
	$(jevent.target).data("is_reuse_checked", true);
    }
}

//Readymade from StackOverFlow...
function check_associative_array_size(aa) {
    var size = 0, key;
    for (key in aa) {
        if (aa.hasOwnProperty(key)) size++;
    }
    return size;
}

function user_modifications(jevent) {
    var message = {};
    message.type = "user_input";
    message.domain = document.domain;
    message.attr_list = {};

    if ('name' in jevent.target.attributes) {
	message.attr_list['name'] = jevent.target.attributes['name'].value;
    }
    else {
	message.attr_list['name'] = 'no-name';
    }

    if ('type' in jevent.target.attributes) {
	message.attr_list['type'] = jevent.target.attributes['type'].value;
    }
    else {
	message.attr_list['type'] = 'no-type';
    }

    try {
	message.attr_list['length'] = $(jevent.target).val().length;
    }
    catch (e) {
	console.log("Appu Error: While calculating length");
	message.attr_list['length'] = -1;
    }

    if (check_associative_array_size(message.attr_list) > 0) {
	chrome.extension.sendMessage("", message);
    }
    else {
	console.log("Appu WARNING: Captured an input elemnt change w/o 'name' or 'type'");
    }
}

//If 'ENTER' is pressed, then unfortunately browser will move on (content scripts cannot hijack events from main scripts),
//before notification is flashed.
//In that case, show the warning as pending warning on the next page.
function check_for_enter(e) {
    if (e.which == 13) {
	if ( e.target.value != "" ) {
	    var message = {};
	    message.type = "check_passwd_reuse";
	    message.domain = document.domain;
	    message.passwd = e.target.value;
	    message.warn_later = true;
	    chrome.extension.sendMessage("", message);
	    $(e.target).data("is_reuse_checked", true);
	}
    }
}

function final_password_reuse_check() {
    var all_passwds = $("input:password");
    for(var i = 0; i < all_passwds.length; i++) {
	if (all_passwds[i].value != "" && all_passwds[i].data("is_reuse_checked") != "true") {
	    var message = {};
	    message.type = "check_passwd_reuse";
	    message.domain = document.domain;
	    message.passwd = all_passwds[i].value;
	    message.warn_later = true;
	    chrome.extension.sendMessage("", message);
	    all_passwds[i].data("is_reuse_checked", true);
	}
    }
}

function is_blacklisted(response) {
    if(response.blacklisted == "no") {
	if ($("input:password").length == 0) {
	    //This means that its a successful login.
	    //Otherwise, password might be wrong.
	    check_pending_warnings();
	}
	//Register for password input type element.
	$('body').on('focusout', 'input:password', check_passwd_reuse);
	$('body').on('keypress', 'input:password', check_for_enter);

	//Finally handle the case for someone enters password and then
	//with mouse clicks on "log in"
	$('body').on('unload', final_password_reuse_check);
	
	//Register for all input type elements. Capture any changes to them.
	//Log which input element user actively changes on a site.
	//DO NOT LOG changes themselves. 
	//This is an excercise to find out on which sites user submits inputs.
	//As always, delegate to "body" to capture dynamically added input elements
	//and also for better performance.
	$('body').on('change', ':input', user_modifications);
    }
    else {
	console.log("Appu: Disabled for this site");
    }
}

function get_permission_to_fetch_pi(domain, send_response) {
	var pi_permission_message = "Appu would like to download your personal information present on " + 
	domain + ". If you choose to do so, Appu would open a new tab and download that information. \
<br/><br/>You can view downloaded information at 'Appu-Menu > My Footprint'. <br/> \
You can change the choice that you make now at any time from 'Appu-Menu > Options'. <br/><br/>\
Do you want Appu to download your personal information from this site?";

	var pi_permission_dialog_msg = sprintf('<div id="appu-pi-permission" class="appuwarning" title="Appu: Notification"> %s </div>', pi_permission_message);
	var pi_permission_dialog_element = $(pi_permission_dialog_msg);
	$("#appu-pi-permission").remove();
	$('body').append(pi_permission_dialog_element);

	//In all popup notification cases, I am stopping further event propagation as we do not want
	//any side-effects on the native web application.
	pi_permission_dialog_box = $('#appu-pi-permission').dialog({ 
	    modal : true, 
	    zIndex: 200,
	    autoOpen : false,
	    draggable : false,
	    resizable : false,
	    position : [ window.innerWidth/2, window.innerHeight/2 ],
	    open : function (event, ui) {
		$('#appu-pi-permission')
		    .dialog("option", "position", [
			window.innerWidth/2 - $('#appu-pi-permission').width()/2, 
			window.innerHeight/2 - $('#appu-pi-permission').height()
		    ]);
	    },
	    width: 550,
	    buttons : [
		{
		    text: "Always",
		    click: function(event) { 
			send_response({
			    'fetch_pi_permission' : 'always',
			});
			$(this).dialog("close"); 
			event.stopPropagation();
		    }
		},
		{
		    text: "Only this time",
		    click: function(event) { 
			send_response({
			    'fetch_pi_permission' : 'seek-permission',
			});
			$(this).dialog("close"); 
			event.stopPropagation();
		    }
		},
		{
		    text: "Never",
		    click: function(event) { 
			send_response({
			    'fetch_pi_permission' : 'never',
			});
			$(this).dialog("close"); 
			event.stopPropagation();
		    }
		}
	    ]});

	//This wrapping has to be done *ONLY* for dialog boxes. 
	//This is according to comment from their developer blog: 
	//http://filamentgroup.com/lab/using_multiple_jquery_ui_themes_on_a_single_page/#commentNumber4
	pi_permission_dialog_box.parents('.ui-dialog:eq(0)')
	    .wrap('<div class="appuwarning appu-permission-box"></div>');
	$('#appu-pi-permission').dialog("open");

	// $('.appu-permission-box .ui-dialog-titlebar-close')
	//     .on("click", function() {close_report_reminder_message();});
}

function show_pending_warnings(r) {
    if(r.pending == "yes") {
	var response = r.warnings;
	msg_type = (response.is_password_reused == "yes") ? "Warning" : "Information";
	    //console.log("Appu: Password is reused");
	var alrt_msg = "<b style='font-size:16px'>Password " + msg_type + "</b> <br/>" +
	    "Estimated Password Cracking Time: <b>" + response.pwd_strength.crack_time_display + "</b><br/>" +
	    "Password not changed for: <b>" + get_password_initialized_readable(response.initialized) + "</b>";

	if (response.is_password_reused == "yes") {	    
	    alrt_msg += "<br/><br/><b style='font-size:16px'> Reused In:</b><br/>";
	    for (var i = 0; i < response.sites.length; i++) {
		alrt_msg += response.sites[i] + "<br/>";
	    }
	}
	
	var dialog_msg = sprintf('<div id="appu-password-pending-warning" class="appuwarning" title="Appu: Password Reuse %s"><p>%s</p></div>', msg_type, alrt_msg);
	var dialog_element = $(dialog_msg);
	$("#appu-password-pending-warning").remove();
	$('body').append(dialog_element);
	
	//This wrapping has to be done *ONLY* for dialog boxes. 
	//This is according to comment from their developer blog: 
	//http://filamentgroup.com/lab/using_multiple_jquery_ui_themes_on_a_single_page/#commentNumber4

	//debugger;
	$('#appu-password-pending-warning').dialog({
	    draggable : false,
	    resizable : false,
	    autoOpen : false,
	    width: 350,
	    maxHeight: 500,
	    //position : ['right', 'bottom'],
	    position : [window.innerWidth - 100, window.innerHeight - 220],
	    hide: { effect: 'drop', direction: "down" },
	    open : function (event, ui) {
		$('#appu-password-pending-warning')
		    .dialog("option", "position", [
			window.innerWidth - $('#appu-password-pending-warning').width(), 
			window.innerHeight - ($('#appu-password-pending-warning').height() +
					      ($('#appu-password-pending-warning').height()/2) - 20)
		    ]);
	    }
	}).parents('.ui-dialog:eq(0)').wrap('<div class="appuwarning"></div>'); 

	$('#appu-password-pending-warning').dialog("open");
	console.log("Here here: Opened window at: " + new Date());

	pwd_pending_warn_timeout = window.setTimeout(function(){
	    $('#appu-password-pending-warning').dialog('close');
	}, 5000);
	
	$('#appu-password-pending-warning').mouseover(function() {
	    window.clearTimeout(pwd_pending_warn_timeout);
	});

	$('#appu-password-pending-warning').mouseout(function() {
	    pwd_pending_warn_timeout = window.setTimeout(function(){
		$('#appu-password-pending-warning').dialog('close');
	    }, 5000);
	});
    }
}

function show_pending_warnings_async(r) {
    window.setTimeout(function() {show_pending_warnings(r)}, 2000);
}

function check_pending_warnings() {
    var message = {};
    message.type = "check_pending_warning";
    chrome.extension.sendMessage("", message, show_pending_warnings_async);
}

function is_status_active(response) {
    if (response.status == "active") {
	console.log(sprintf("Appu: [%s]: Extension is enabled", new Date()));
	is_appu_active = true;

	show_appu_monitor_icon();
	$(window).resize(show_appu_monitor_icon);

	var message = {};
	message.type = "check_blacklist";
	message.domain = document.domain;
	//Appu is enabled. Check if the current site is blacklisted.
	//If not, then register for password input type.
	chrome.extension.sendMessage("", message, is_blacklisted);

	// 5 seconds is just some random period to get page ready in case
	// of Ajax apps. (for e.g. in case of gmail, the .load() is fired
	// even if the page is absolutely blank).
	window.setTimeout(detect_if_user_logged_in, 5 * 1000);
    }
    else if(response.status == "process_template") {
	// I am created with the sole purpose of downloading PI information
	// Once that is done, I would be closed.
	console.log("Appu: Ready to process template");

	var template_msg = sprintf('<div id="appu-template-process" class="appuwarning" title="Appu: Downloading Information"><p>%s</p></div>', "DO NOT CLOSE, Appu is downloading your information");
	var dialog_element = $(template_msg);
	$("#appu-template-process").remove();
	$('body').append(dialog_element);
	
	//This wrapping has to be done *ONLY* for dialog boxes. 
	//This is according to comment from their developer blog: 
	//http://filamentgroup.com/lab/using_multiple_jquery_ui_themes_on_a_single_page/#commentNumber4
	$('#appu-template-process').dialog({
	    draggable : false,
	    resizable : false,
	    autoOpen : false,
	    //position : ['right', 'bottom'],
	    position : [ window.innerWidth/2, window.innerHeight/2 ],
	    open : function (event, ui) {
		$('#appu-template-process')
		    .dialog("option", "position", [
			window.innerWidth/2 - $('#appu-template-process').width()/2, 
			window.innerHeight/2 - $('#appu-template-process').height()
		    ]);
	    },
	}).parents('.ui-dialog:eq(0)').wrap('<div class="appuwarning"></div>'); 

	$('#appu-template-process').dialog("open");
    }
    else {
	console.log("Appu: Extension is currently disabled");
    }
}


function apply_css_filter(elements, css_filter) {
    if (css_filter && css_filter != "") {
	return $(elements).filter(css_filter);
    }
    return elements;
}

function apply_css_selector(elements, css_selector) {
    if (css_selector && css_selector != "") {
	return $(css_selector, elements);
    }
    return elements;
}

function simulate_click_worked(mutations, observer, simulate_done_timer, css_selector) {
    if ($(css_selector).length > 0) {
	console.log("Here here: Simulate click was successful");
	observer.disconnect();
	window.clearTimeout(simulate_done_timer);
	var message = {};
	message.type = "simulate_click_done";
	chrome.extension.sendMessage("", message);
    }
}

var start_focus_time = undefined;

function focus_check() {
    if (start_focus_time != undefined) {
	var curr_time = new Date();
	if((curr_time.getTime() - last_user_interaction.getTime()) > (300 * 1000)) {
	    //No interaction in this tab for last 5 minutes. Probably idle.
	    window_unfocused();
	}
    }
}

function window_focused(eo) {
    last_user_interaction = new Date();
    if (start_focus_time == undefined) {
	start_focus_time = new Date();
	// var message = {};
	// message.type = "i_have_focus";
	// chrome.extension.sendMessage("", message);
    }
}

function window_unfocused(eo) {
    if (start_focus_time != undefined) {
	var stop_focus_time = new Date();
	var total_focus_time = stop_focus_time.getTime() - start_focus_time.getTime();
	start_focus_time = undefined;
	var message = {};
	message.type = "time_spent";
	message.domain = document.domain;
	message.am_i_logged_in = am_i_logged_in;
	message.time_spent = total_focus_time;
	chrome.extension.sendMessage("", message);
    }
}


//Case insensitive "contains" .. from stackoverflow with thanks
//http://stackoverflow.com/questions/2196641/how-do-i-make-jquery-contains-case-insensitive-including-jquery-1-8
$.expr[":"].Contains = $.expr.createPseudo(function(arg) {
    return function( elem ) {
        return $(elem).text().toUpperCase().indexOf(arg.toUpperCase()) >= 0;
    };
});

//Detecting if a user has logged in or not is a bit tricky.
//Usually if a user has logged in, then there is a link somewhere on
//the webpage for logging out. That is a sufficient condition to
//identify that the user has logged in.
//However, for certain sites like stackoverflow, such a link is not
//"generated" until you click on the drop-down box for a logged in user
//(I am guessing this is because they also want to generate all sorts of
// stats for that user). 
//However, on SO, if a user has not logged in, then there is a prominent
//"log in" link. So for such site, detecting if user has logged in
//is negating the presence of "log in" link on the webpage.
//I am sure there will be sites that do no satisfy either category.
//But thats for later....

//If we find any log-in links, then the user has certainly not logged in.
function detect_login_links() {
    var signin_patterns = ["Sign in", "Log in", "Login"];   
    var signin_elements = $([]);
    
    console.log("Here here: Detecting 'log in's");

    signin_patterns.forEach(function(value, index, array) {
	signin_elements = signin_elements.add($(":Contains('" + value + "')"));
    });
    return signin_elements;
}

//If we can detect log-out links on a page then that means a user has
//certainly logged in.
function detect_logout_links() {
    var signout_patterns = ["Sign out", "Log Out", "Logout"];   
    var signout_elements = $([]);
    
    console.log("Here here: Detecting 'log out's");

    signout_patterns.forEach(function(value, index, array) {
	signout_elements = signout_elements.add($(":Contains('" + value + "')").filter(function() { 
	    if (this.tagName == "SCRIPT") {
		return false;
	    }
	    if (this.tagName == "NOSCRIPT") {
		return false;
	    }
	    return ($(this).children().length < 1); 
	}));
    });

    //Special case for sites like Facebook
    if (signout_elements.length == 0) {
	signout_patterns.forEach(function(value, index, array) {
	    signout_elements = signout_elements.add($(":input[value='"+ value +"']").filter(function() { 
		if (this.tagName == "SCRIPT") {
		    return false;
		}
		if (this.tagName == "NOSCRIPT") {
		    return false;
		}
		return ($(this).children().length < 1); 
	    }));
	});
    }

    //Special case for sites like Dropbox....need to generalize it later
    if (signout_elements.length == 0 && document.domain == "www.dropbox.com") {
	signout_elements = signout_elements.add($(":contains('Sign out')")
						.filter(function() { return (this.tagName == 'A'); }));
    }
    return signout_elements;
}

function monitor_explicit_logouts(eo) {
    console.log("Here here");
    var signout_event = false;
    if ((eo.type == "click") || (eo.type == "keypress" && eo.which == 13)) {
	var message = {};
	message.type = "explicit_sign_out";
	message.domain = document.domain;
	chrome.extension.sendMessage("", message);
	console.log("Here here: Sending message that I explicitly signed out");
    }
}

function detect_if_user_logged_in() {
    var signin_elements = [];
    var signout_elements = detect_logout_links();
    if (signout_elements.length == 0) {
	signin_elements = detect_login_links();
    }
    else {
	$(signout_elements).on('click.monitor_explicit_logouts', monitor_explicit_logouts);
	$(signout_elements).on('keypress.monitor_explicit_logouts', monitor_explicit_logouts);
    }

    if (signout_elements.length > 0 && signin_elements.length == 0) {
	var message = {};
	message.type = "signed_in";
	message.value = 'yes';
	message.domain = document.domain;
	chrome.extension.sendMessage("", message);
	console.log("Here here: Sending message that I am signed in");
	am_i_logged_in = true;
    }
    else if (signin_elements.length > 0 && signout_elements.length == 0) {
	var message = {};
	message.type = "signed_in";
	message.value = 'no';
	message.domain = document.domain;
	chrome.extension.sendMessage("", message);
	console.log("Here here: Sending message that I am *NOT* signed in");
    }
    else {
	var message = {};
	message.type = "signed_in";
	message.value = 'unsure';
	message.domain = document.domain;
	chrome.extension.sendMessage("", message);
	console.log("Here here: Sending message that SignIn status is *UNSURE*");
    }
}

function update_status(new_status) {
    var dialog_msg = sprintf('<div id="appu-status-update-warning" class="appuwarning" title="Appu: Status Change"><p>%s</p><br/>%s</div>', new_status, new Date());
	var dialog_element = $(dialog_msg);
	$("#appu-status-update-warning").remove();
	$('body').append(dialog_element);
	
	//This wrapping has to be done *ONLY* for dialog boxes. 
	//This is according to comment from their developer blog: 
	//http://filamentgroup.com/lab/using_multiple_jquery_ui_themes_on_a_single_page/#commentNumber4

	$('#appu-status-update-warning').dialog({
	    draggable : false,
	    resizable : false,
	    autoOpen : false,
	    // position : ['right', 'bottom'],
	    // hide: { effect: 'drop', direction: "down" }
	    position : [window.innerWidth - 100, window.innerHeight - 220],
	    hide: { effect: 'drop', direction: "down" },
	    open : function (event, ui) {
		$('#appu-status-update-warning')
		    .dialog("option", "position", [
			window.innerWidth - $('#appu-status-update-warning').width(), 
			window.innerHeight - ($('#appu-status-update-warning').height() +
					      ($('#appu-status-update-warning').height()/2) + 20)
		    ]);
	    },
	}).parents('.ui-dialog:eq(0)').wrap('<div class="appuwarning"></div>'); 

	$('#appu-status-update-warning').dialog("open");
	console.log("Here here: Opened window at: " + new Date());
	window.setTimeout(function(){
	    $('#appu-status-update-warning').dialog('close');
	    console.log("Here here: Closed window at: " + new Date());
	}, 3000);
}

function hide_appu_monitor_icon() {
    $("#appu-monitor-icon").hide();
}

function show_appu_monitor_icon() {
    if (is_appu_active) {
	if ($("#appu-monitor-icon").length == 0) {
	    var appu_img_src = chrome.extension.getURL('images/appu_new19.png');
	    var appu_img = $("<img id='appu-monitor-icon' src='" + appu_img_src + "'></img>");
	    $("body").append(appu_img);
	    $("#appu-monitor-icon").attr("title", "Appu is currently enabled. " + 
					 "You can disable it from Appu-Menu > Disable Appu")
	}
	else {
	    $("#appu-monitor-icon").show();
	}
	    
	$("#appu-monitor-icon").css({
		"position" : "fixed",
		    //I have to use hardcoded value here because if I dynamically calculate
		    //the value using .height(), the element is not rendered and hence
		    //height is zero.
		    "top" : window.innerHeight - 19,
		    "left" : 0, 
		    });
	
	$(function() {
		$("#appu-monitor-icon").tooltip({ 
			    position: { my: "left+15 center-25", at: "right"},
			    tooltipClass : "appu-monitor-icon-tooltip",
			    });
	    });
    }
}

$(window).on('unload', window_unfocused);
$(window).on("focus", window_focused);
$(window).on("blur", window_unfocused);

$(document).ready(function() {
    var message = {};
    message.type = "query_status";
    message.url = document.domain;
    chrome.extension.sendMessage("", message, is_status_active);
});


$(window).on("click.do_i_have_focus", function() {
    $(window).off("click.do_i_have_focus");
    window_focused(undefined);
});

$(window).on("keypress.do_i_have_focus", function() {
    $(window).off("keypress.do_i_have_focus");
    window_focused(undefined);
});

//No point in doing following.
//What if a user is watching video?
//setInterval(focus_check, 300 * 1000);

$(window).on("load", function() {
    var message = {};
    message.type = "am_i_active";
    chrome.extension.sendMessage("", message, function (r) {
	if (r.am_i_active) {
	    window_focused(undefined);
	}
    });
});

chrome.extension.onMessage.addListener(function(message, sender, send_response) {
    if (message.type == "report-reminder") {
	show_report_ready_modal_dialog();
    }
    else if (message.type == "status-enabled") {
	console.log("Here here: status-enabled");
	is_appu_active = true;
	show_appu_monitor_icon();
	update_status('Appu is enabled');
    }
    else if (message.type == "status-disabled") {
	console.log("Here here: status-disabled");
	is_appu_active = false;
	hide_appu_monitor_icon();
	update_status('Appu is disabled');
    }
    else if (message.type == "you_are_active") {
	window_focused();
    }
    else if (message.type == "close-report-reminder") {
	close_report_ready_modal_dialog();
    }
    else if (message.type == "goto-url") {
	window.location = message.url;
    }
    else if (message.type == "simulate-click") {
	var element_to_click = apply_css_filter(apply_css_selector($(document), message.css_selector), 
						message.css_filter);

	var detect_change_css = message.detect_change_css;  

	//Hard timeout
	//Wait for 60 seconds before sending event that click cannot be 
	//completed.
	var simulate_done_timer = window.setTimeout(function() {
	    var message = {};
	    message.type = "simulate_click_done";
	    chrome.extension.sendMessage("", message);
	}, 60 * 1000);


	MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

	var observer = new MutationObserver(function(mutations, observer) {
	    simulate_click_worked(mutations, observer, simulate_done_timer, detect_change_css);
	});

	//var config = { attributes: true, childList: true, characterData: true }
	var config = { subtree: true, characterData: true, childList: true, attributes: true }
	observer.observe(document, config);

	//Now do the actual click
	$(element_to_click).trigger("click");
    }
    else if (message.type == "get-html") {
	var html_data = $("html").html();
	send_response(html_data);
    }
    else if (message.type == "get-permission-to-fetch-pi") {
	get_permission_to_fetch_pi(message.site, send_response);
	return true;
    }
});

