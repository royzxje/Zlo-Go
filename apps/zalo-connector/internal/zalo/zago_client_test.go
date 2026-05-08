package zalo

import "testing"

func TestNewZagoClientRequiresIMEI(t *testing.T) {
	client, err := NewZagoClient(Config{IMEI: ""})
	if err == nil {
		t.Fatal("expected missing IMEI to return an error")
	}
	if client != nil {
		t.Fatalf("expected nil client on error, got %#v", client)
	}
}

func TestZagoClientSatisfiesClientInterface(t *testing.T) {
	var _ Client = (*ZagoClient)(nil)
}
