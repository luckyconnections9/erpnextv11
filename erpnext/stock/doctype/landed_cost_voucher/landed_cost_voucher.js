// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt


frappe.provide("erpnext.stock");

erpnext.stock.LandedCostVoucher = erpnext.stock.StockController.extend({
	setup: function() {
		var me = this;
		this.frm.fields_dict.purchase_receipts.grid.get_field('receipt_document').get_query =
			function (doc, cdt, cdn) {
				var d = locals[cdt][cdn]

				var filters = [
					[d.receipt_document_type, 'docstatus', '=', '1'],
					[d.receipt_document_type, 'company', '=', me.frm.doc.company],
				]

				if (d.receipt_document_type == "Purchase Invoice") {
					filters.push(["Purchase Invoice", "update_stock", "=", "1"])
				}



				if (!me.frm.doc.company) frappe.msgprint(__("Please enter company first"));
				return {
					filters: filters
				}
				if(d.receipt_document_type == "Purchase Order"){
					this.frm.add_fetch("receipt_document", "posting_date", "transaction_date");
				}
				else{
					this.frm.add_fetch("receipt_document", "posting_date", "posting_date");
				}
			};

		this.frm.add_fetch("receipt_document", "supplier", "supplier");
		this.frm.add_fetch("receipt_document", "base_grand_total", "grand_total");

	},

	refresh: function(frm) {
		var help_content =
			`<br><br>
			<table class="table table-bordered" style="background-color: #f9f9f9;">
				<tr><td>
					<h4>
						<i class="fa fa-hand-right"></i> 
						${__("Notes")}:
					</h4>
					<ul>
						<li>
							${__("Charges will be distributed proportionately based on item qty or amount, as per your selection")}
						</li>
						<li>
							${__("Remove item if charges is not applicable to that item")}
						</li>
						<li>
							${__("Charges are updated in Purchase Receipt against each item")}
						</li>
						<li>
							${__("Item valuation rate is recalculated considering landed cost voucher amount")}
						</li>
						<li>
							${__("Stock Ledger Entries and GL Entries are reposted for the selected Purchase Receipts")}
						</li>
					</ul>
				</td></tr>
			</table>`;

		set_field_options("landed_cost_help", help_content);
	},

	get_items_from_purchase_order: function(frm) {
		var me = this;
		if(!this.frm.doc.purchase_receipts.length) {
			frappe.msgprint(__("Please enter Purchase Order first"));
		} else {
			return this.frm.call({
				doc: me.frm.doc,
				method: "get_items_from_purchase_receipts",
				callback: function(r, rt) {
					console.log(r);
					me.set_applicable_charges_for_item();
				}
			});
		}
			console.log("abc")

	},
		

	amount: function(frm) {
		this.set_total_taxes_and_charges();
		this.set_applicable_charges_for_item();
	},
	gross_weight: function(frm) {
		this.set_total_taxes_and_charges();
		this.set_applicable_charges_for_item();
	},

	set_total_taxes_and_charges: function() {
		var total_taxes_and_charges = 0.0;
		$.each(this.frm.doc.taxes || [], function(i, d) {
			total_taxes_and_charges += flt(d.amount)
		});
		cur_frm.set_value("total_taxes_and_charges", total_taxes_and_charges);
	},

	set_applicable_charges_for_item: function(frm,cdt,cdn) {
		var me = this;
		var total_qty2=0.0;
		var total_weight2=0.0;
		$.each(this.frm.doc.items || [], function(i, item) {
			total_qty2 += item.qty
			total_weight2 += item.gross_weight

		})
		cur_frm.set_value("total_boxes",total_qty2)
		cur_frm.set_value("total_weight",total_weight2)
		console.log("abc")


		if(this.frm.doc.taxes.length) {
			
			var total_item_cost = 0.0;
			var based_on = this.frm.doc.distribute_charges_based_on.toLowerCase();
			if(based_on=="gross weight"){
				based_on='gross_weight'
			}
			$.each(this.frm.doc.items || [], function(i, d) {
				total_item_cost += flt(d[based_on])
			});
			if(based_on=="gross_weight"){
			var total_charges = 0.0;
			var total_qty=0.0;
			var total_weight=0.0;
			$.each(this.frm.doc.items || [], function(i, item) {
				item.applicable_charges = flt(item[based_on]) * flt(me.frm.doc.total_taxes_and_charges) / flt(total_item_cost)
				item.lcost_box=flt(flt(item.amount)+flt(item.applicable_charges))/flt(item.qty)
				console.log("item.applicable_charges"+item.applicable_charges)
				item.applicable_charges = flt(item.applicable_charges, precision("applicable_charges", item))
				item.lcost_box=flt(item.lcost_box, precision("lcost_box", item))
				total_charges += item.applicable_charges
				total_qty += item.qty
				total_weight += item.gross_weight
				console.log(item.lcost_box)
			});

			if (total_charges != this.frm.doc.total_taxes_and_charges){
				var diff = this.frm.doc.total_taxes_and_charges - flt(total_charges)
				this.frm.doc.items.slice(-1)[0].applicable_charges += diff
			}
			refresh_field("items");
			console.log("total_qty"+total_qty)
			console.log("total_weight"+total_weight)
			cur_frm.set_value("total_boxes",total_qty)
			cur_frm.set_value("total_weight",total_weight)
			}else{
				var total_charges = 0.0;
				var total_qty1=0.0;
				var total_weight1=0.0;
				$.each(this.frm.doc.items || [], function(i, item) {
					if(based_on=="manual")
					{
						item.applicable_charges = item.applicable_charges
					}
					else 
					{
						item.applicable_charges = flt(item[based_on]) * flt(me.frm.doc.total_taxes_and_charges) / flt(total_item_cost)
						if(isNaN(item.applicable_charges)) { item.applicable_charges = ""; }
					}
					console.log("item.applicable_charges"+item.applicable_charges)
					item.lcost_box=''
					item.applicable_charges = flt(item.applicable_charges, precision("applicable_charges", item))
					total_charges += item.applicable_charges
					total_qty1 += item.qty
					total_weight1 += item.gross_weight
				});
				console.log("total_charges"+total_charges)
				console.log("this.frm.doc.total_taxes_and_charges"+this.frm.doc.total_taxes_and_charges)

				if (total_charges != this.frm.doc.total_taxes_and_charges && based_on != "manual"){
					var diff = this.frm.doc.total_taxes_and_charges - flt(total_charges)
					this.frm.doc.items.slice(-1)[0].applicable_charges += diff
				}
				refresh_field("items");
			cur_frm.set_value("total_boxes",total_qty1)
			cur_frm.set_value("total_weight",total_weight1)



}
		}
	},
	distribute_charges_based_on: function (frm) {
		this.set_applicable_charges_for_item();
		var based_on = this.frm.doc.distribute_charges_based_on.toLowerCase();
			if(based_on=="manual")
			{
				var total_weight1=0.0;
				var total_charges = 0;
				$.each(this.frm.doc.items || [], function(i, item) {
					item.applicable_charges = "";
					total_weight1 += item.gross_weight
				});
				
				refresh_field("items");
				//cur_frm.set_value("selected_total", 0);
				//cur_frm.set_value("selected_difference", this.frm.doc.total_taxes_and_charges);
			}
			//else
			//{
				var ttl = 0;
				var diff = 0;
				(this.frm.fields_dict.items.grid.grid_rows || []).forEach(function(row) { 
					if(row.doc.__checked) 
					{ 
						if(row.doc.applicable_charges)
						{
							amount = flt(row.doc.applicable_charges);
							ttl = ttl+amount;						 
						}
					} 
					
				})
				refresh_field("items");
				diff = flt(this.frm.doc.total_taxes_and_charges) - flt(ttl);
				if(ttl == 0) { diff = 0;}
				cur_frm.set_value("selected_total", ttl.toFixed(2));
				cur_frm.set_value("selected_difference", diff.toFixed(2));
			//}
	}

});

cur_frm.script_manager.make(erpnext.stock.LandedCostVoucher);
